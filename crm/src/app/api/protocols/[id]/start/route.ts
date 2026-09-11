import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { HandoverProtocolRow } from "@/types/db";

export async function POST(_req: Request, ctx: RouteContext<"/api/protocols/[id]/start">) {
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
    if (protocol.status !== "PENDING_INSTALL") {
      throw new ValidationError("Biên bản không ở trạng thái Chờ lắp đặt");
    }

    const cas = await db
      .prepare(
        `UPDATE handover_protocols SET status = 'INSTALLING', installed_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ? AND status = 'PENDING_INSTALL'`
      )
      .bind(id)
      .run();
    if (!cas.meta.changes) throw new ValidationError("Biên bản đã được bắt đầu trước đó");

    await writeAuditLog({ userId: session.user.id, action: "START_PROTOCOL_INSTALL", entity: "handover_protocol", entityId: id });

    const updated = await db.prepare(`SELECT * FROM handover_protocols WHERE id = ?`).bind(id).first();
    return NextResponse.json({ protocol: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
