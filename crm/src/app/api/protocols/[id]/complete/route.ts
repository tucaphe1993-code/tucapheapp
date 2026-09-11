import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { HandoverProtocolRow } from "@/types/db";

export async function POST(_req: Request, ctx: RouteContext<"/api/protocols/[id]/complete">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const db = getDb();

    const protocol = await db
      .prepare(`SELECT * FROM handover_protocols WHERE id = ?`)
      .bind(id)
      .first<HandoverProtocolRow>();
    if (!protocol) throw new NotFoundError("Không tìm thấy biên bản");
    if (protocol.status !== "WARRANTY_ACTIVATED") {
      throw new ValidationError("Chỉ hoàn tất sau khi đã kích hoạt bảo hành");
    }

    const cas = await db
      .prepare(
        `UPDATE handover_protocols SET status = 'COMPLETED', updated_at = datetime('now')
         WHERE id = ? AND status = 'WARRANTY_ACTIVATED'`
      )
      .bind(id)
      .run();
    if (!cas.meta.changes) throw new ValidationError("Biên bản đã hoàn tất trước đó");

    await writeAuditLog({ userId: session.user.id, action: "COMPLETE_PROTOCOL", entity: "handover_protocol", entityId: id });

    const updated = await db.prepare(`SELECT * FROM handover_protocols WHERE id = ?`).bind(id).first();
    return NextResponse.json({ protocol: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
