import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { handleApiError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { TaskChecklistRow, TaskRow } from "@/types/db";

const bodySchema = z.object({ checked: z.boolean() });

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/tasks/[id]/checklist/[checklistId]">
) {
  try {
    const session = await requireRole("ADMIN", "EMPLOYEE");
    const { id, checklistId } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) throw new ValidationError("Dữ liệu không hợp lệ");

    const db = getDb();
    const task = await db.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(id).first<TaskRow>();
    if (!task) throw new NotFoundError("Không tìm thấy công việc");
    if (session.user.role === "EMPLOYEE" && task.assigned_to !== session.user.id) {
      throw new ForbiddenError();
    }
    if (task.status !== "IN_PROGRESS") {
      throw new ValidationError("Chỉ cập nhật checklist khi công việc đang thực hiện");
    }

    const item = await db
      .prepare(`SELECT * FROM task_checklists WHERE id = ? AND task_id = ?`)
      .bind(checklistId, id)
      .first<TaskChecklistRow>();
    if (!item) throw new NotFoundError("Không tìm thấy mục checklist");

    await db
      .prepare(
        `UPDATE task_checklists SET is_checked = ?, checked_at = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(parsed.data.checked ? 1 : 0, parsed.data.checked ? new Date().toISOString() : null, checklistId)
      .run();

    const updated = await db
      .prepare(`SELECT * FROM task_checklists WHERE id = ?`)
      .bind(checklistId)
      .first();
    return NextResponse.json({ item: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
