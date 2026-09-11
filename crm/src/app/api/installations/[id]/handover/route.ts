import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { recordDeviceHistory } from "@/lib/services/devices";
import { handleApiError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { DeviceRow, InstallationRow, ProductVariantRow } from "@/types/db";

export async function POST(_req: Request, ctx: RouteContext<"/api/installations/[id]/handover">) {
  try {
    const session = await requireRole("ADMIN", "EMPLOYEE");
    const { id } = await ctx.params;
    const db = getDb();

    const installation = await db
      .prepare(`SELECT * FROM installations WHERE id = ?`)
      .bind(id)
      .first<InstallationRow>();
    if (!installation) throw new NotFoundError("Không tìm thấy job lắp đặt");
    if (session.user.role === "EMPLOYEE" && installation.technician_id !== session.user.id) {
      throw new ForbiddenError();
    }
    if (installation.status !== "COMPLETED") {
      throw new ValidationError("Job lắp đặt phải hoàn thành trước khi bàn giao");
    }

    const cas = await db
      .prepare(
        `UPDATE installations SET status = 'HANDED_OVER', handed_over_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ? AND status = 'COMPLETED'`
      )
      .bind(id)
      .run();
    if (!cas.meta.changes) throw new ValidationError("Job lắp đặt đã được bàn giao trước đó");

    // Spec: khi bàn giao xong, gắn Serial với khách hàng + bắt đầu bảo hành
    // theo ngày bàn giao (mặc định — có thể sửa lại sau tại trang thiết bị).
    if (installation.device_id) {
      const device = await db
        .prepare(`SELECT * FROM devices WHERE id = ?`)
        .bind(installation.device_id)
        .first<DeviceRow>();
      if (device && !device.warranty_start_date) {
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
          .bind(installation.customer_id, device.id)
          .run();
        await recordDeviceHistory(db, {
          deviceId: device.id,
          eventType: "STATUS_CHANGE",
          fromStatus: device.status,
          toStatus: "IN_USE",
          orderId: installation.order_id,
          customerId: installation.customer_id,
          note: "Bàn giao lắp đặt — bắt đầu bảo hành",
          createdBy: session.user.id,
        });
      }
    }

    await writeAuditLog({
      userId: session.user.id,
      action: "HANDOVER_INSTALLATION",
      entity: "installation",
      entityId: id,
    });

    const updated = await db.prepare(`SELECT * FROM installations WHERE id = ?`).bind(id).first();
    return NextResponse.json({ installation: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
