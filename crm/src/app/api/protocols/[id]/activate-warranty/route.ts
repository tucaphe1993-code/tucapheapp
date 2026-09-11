import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { recordDeviceHistory } from "@/lib/services/devices";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type {
  DeviceRow,
  HandoverProtocolDeviceRow,
  HandoverProtocolRow,
  ProductVariantRow,
} from "@/types/db";

export async function POST(_req: Request, ctx: RouteContext<"/api/protocols/[id]/activate-warranty">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const db = getDb();

    const protocol = await db
      .prepare(`SELECT * FROM handover_protocols WHERE id = ?`)
      .bind(id)
      .first<HandoverProtocolRow>();
    if (!protocol) throw new NotFoundError("Không tìm thấy biên bản");
    if (protocol.status !== "HANDED_OVER") {
      throw new ValidationError("Chỉ kích hoạt bảo hành sau khi đã bàn giao (đủ chữ ký 2 bên)");
    }

    const cas = await db
      .prepare(
        `UPDATE handover_protocols SET status = 'WARRANTY_ACTIVATED', warranty_activated_at = datetime('now'),
           warranty_activated_by = ?, updated_at = datetime('now')
         WHERE id = ? AND status = 'HANDED_OVER'`
      )
      .bind(session.user.id, id)
      .run();
    if (!cas.meta.changes) throw new ValidationError("Bảo hành đã được kích hoạt trước đó");

    const { results: protocolDevices } = await db
      .prepare(`SELECT * FROM handover_protocol_devices WHERE protocol_id = ? AND device_id IS NOT NULL`)
      .bind(id)
      .all<HandoverProtocolDeviceRow>();

    for (const pd of protocolDevices) {
      const device = await db.prepare(`SELECT * FROM devices WHERE id = ?`).bind(pd.device_id).first<DeviceRow>();
      if (!device || device.warranty_start_date) continue; // idempotent — never overwrite an existing warranty window

      const variant = await db
        .prepare(`SELECT * FROM product_variants WHERE id = ?`)
        .bind(device.product_variant_id)
        .first<ProductVariantRow>();
      const warrantyMonths =
        variant?.warranty_months && Number.isInteger(variant.warranty_months) ? variant.warranty_months : null;
      const warrantyEndExpr = warrantyMonths ? `datetime('now', '+${warrantyMonths} months')` : "NULL";

      await db
        .prepare(
          `UPDATE devices SET status = 'IN_USE', customer_id = ?, handed_over_at = datetime('now'),
             warranty_start_date = datetime('now'), warranty_end_date = ${warrantyEndExpr}, updated_at = datetime('now')
           WHERE id = ?`
        )
        .bind(protocol.customer_id, device.id)
        .run();

      await recordDeviceHistory(db, {
        deviceId: device.id,
        eventType: "STATUS_CHANGE",
        fromStatus: device.status,
        toStatus: "IN_USE",
        orderId: protocol.order_id,
        customerId: protocol.customer_id,
        note: `Kích hoạt bảo hành qua biên bản ${protocol.protocol_code}`,
        createdBy: session.user.id,
      });
    }

    await writeAuditLog({
      userId: session.user.id,
      action: "ACTIVATE_PROTOCOL_WARRANTY",
      entity: "handover_protocol",
      entityId: id,
    });

    const updated = await db.prepare(`SELECT * FROM handover_protocols WHERE id = ?`).bind(id).first();
    return NextResponse.json({ protocol: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
