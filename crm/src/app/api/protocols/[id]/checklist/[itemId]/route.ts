import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { handleApiError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { HandoverProtocolRow } from "@/types/db";

const bodySchema = z.object({ checked: z.boolean(), note: z.string().trim().optional() });

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/protocols/[id]/checklist/[itemId]">) {
  try {
    const session = await requireRole("ADMIN", "EMPLOYEE");
    const { id, itemId } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) throw new ValidationError("Dữ liệu không hợp lệ");

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
      throw new ValidationError("Chỉ cập nhật checklist khi biên bản đang ở trạng thái Đang lắp đặt");
    }

    const item = await db
      .prepare(`SELECT id FROM handover_protocol_checklist WHERE id = ? AND protocol_id = ?`)
      .bind(itemId, id)
      .first();
    if (!item) throw new NotFoundError("Không tìm thấy mục checklist");

    await db
      .prepare(
        `UPDATE handover_protocol_checklist SET is_checked = ?, note = COALESCE(?, note),
           checked_at = ? WHERE id = ?`
      )
      .bind(
        parsed.data.checked ? 1 : 0,
        parsed.data.note ?? null,
        parsed.data.checked ? new Date().toISOString() : null,
        itemId
      )
      .run();

    const updated = await db
      .prepare(`SELECT * FROM handover_protocol_checklist WHERE id = ?`)
      .bind(itemId)
      .first();
    return NextResponse.json({ item: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
