import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { handleApiError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { InstallationChecklistRow, InstallationRow } from "@/types/db";

const bodySchema = z.object({ checked: z.boolean() });

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/installations/[id]/checklist/[checklistId]">
) {
  try {
    const session = await requireRole("ADMIN", "EMPLOYEE");
    const { id, checklistId } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) throw new ValidationError("Dữ liệu không hợp lệ");

    const db = getDb();
    const installation = await db
      .prepare(`SELECT * FROM installations WHERE id = ?`)
      .bind(id)
      .first<InstallationRow>();
    if (!installation) throw new NotFoundError("Không tìm thấy job lắp đặt");
    if (session.user.role === "EMPLOYEE" && installation.technician_id !== session.user.id) {
      throw new ForbiddenError();
    }
    if (installation.status !== "IN_PROGRESS") {
      throw new ValidationError("Chỉ cập nhật checklist khi job đang thực hiện");
    }

    const item = await db
      .prepare(`SELECT * FROM installation_checklists WHERE id = ? AND installation_id = ?`)
      .bind(checklistId, id)
      .first<InstallationChecklistRow>();
    if (!item) throw new NotFoundError("Không tìm thấy mục checklist");

    await db
      .prepare(
        `UPDATE installation_checklists SET is_checked = ?, checked_at = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(parsed.data.checked ? 1 : 0, parsed.data.checked ? new Date().toISOString() : null, checklistId)
      .run();

    const updated = await db
      .prepare(`SELECT * FROM installation_checklists WHERE id = ?`)
      .bind(checklistId)
      .first();
    return NextResponse.json({ item: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
