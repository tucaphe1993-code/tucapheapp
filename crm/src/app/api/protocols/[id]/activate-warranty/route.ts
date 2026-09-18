import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { activateProtocolDeviceWarranties } from "@/lib/services/protocols";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { HandoverProtocolRow } from "@/types/db";

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
      throw new ValidationError("Chỉ kích hoạt bảo hành sau khi đã bàn giao (Bên A đã ký)");
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

    await activateProtocolDeviceWarranties(db, {
      protocolId: id,
      protocolCode: protocol.protocol_code,
      orderId: protocol.order_id,
      customerId: protocol.customer_id,
      activatedBy: session.user.id,
    });

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
