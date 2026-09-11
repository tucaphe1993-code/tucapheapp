import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { HandoverProtocolChecklistRow, HandoverProtocolRow } from "@/types/db";

export async function POST(_req: Request, ctx: RouteContext<"/api/protocols/[id]/submit-for-confirmation">) {
  try {
    const session = await requireRole("ADMIN", "EMPLOYEE");
    const { id } = await ctx.params;
    const db = getDb();

    const protocol = await db
      .prepare(`SELECT * FROM handover_protocols WHERE id = ?`)
      .bind(id)
      .first<HandoverProtocolRow>();
    if (!protocol) throw new NotFoundError("Không tìm thấy biên bản");
    if (session.user.role === "EMPLOYEE" && protocol.technician_id !== session.user.id) {
      throw new ForbiddenError();
    }
    if (protocol.status !== "INSTALLING") {
      throw new ValidationError("Biên bản phải đang ở trạng thái Đang lắp đặt");
    }

    const { results: checklist } = await db
      .prepare(`SELECT * FROM handover_protocol_checklist WHERE protocol_id = ?`)
      .bind(id)
      .all<HandoverProtocolChecklistRow>();
    const unchecked = checklist.filter((c) => !c.is_checked);
    if (unchecked.length > 0) {
      throw new ValidationError(`Còn ${unchecked.length} mục checklist chưa hoàn thành`);
    }

    const cas = await db
      .prepare(
        `UPDATE handover_protocols SET status = 'PENDING_CONFIRMATION', updated_at = datetime('now')
         WHERE id = ? AND status = 'INSTALLING'`
      )
      .bind(id)
      .run();
    if (!cas.meta.changes) throw new ValidationError("Biên bản đã được chuyển trạng thái trước đó");

    await writeAuditLog({
      userId: session.user.id,
      action: "SUBMIT_PROTOCOL_FOR_CONFIRMATION",
      entity: "handover_protocol",
      entityId: id,
    });

    const updated = await db.prepare(`SELECT * FROM handover_protocols WHERE id = ?`).bind(id).first();
    return NextResponse.json({ protocol: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
