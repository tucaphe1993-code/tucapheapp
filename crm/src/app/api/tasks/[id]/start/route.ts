import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { TaskRow } from "@/types/db";

export async function POST(_req: Request, ctx: RouteContext<"/api/tasks/[id]/start">) {
  try {
    const session = await requireRole("ADMIN", "EMPLOYEE");
    const { id } = await ctx.params;
    const db = getDb();

    const task = await db.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(id).first<TaskRow>();
    if (!task) throw new NotFoundError("Không tìm thấy công việc");
    if (session.user.role === "EMPLOYEE" && task.assigned_to !== session.user.id) {
      throw new ForbiddenError();
    }
    if (task.status !== "TODO") {
      throw new ValidationError("Công việc đã được bắt đầu hoặc không còn ở trạng thái CẦN LÀM");
    }

    const cas = await db
      .prepare(
        `UPDATE tasks SET status = 'IN_PROGRESS', started_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ? AND status = 'TODO'`
      )
      .bind(id)
      .run();
    if (!cas.meta.changes) throw new ValidationError("Công việc đã được bắt đầu trước đó");

    await db
      .prepare(
        `UPDATE orders SET status = 'PACKING', updated_at = datetime('now') WHERE id = ? AND status = 'CONFIRMED'`
      )
      .bind(task.order_id)
      .run();

    // Report row is created now (not at completion) so photos can be
    // attached to it while packing is still in progress (spec §13).
    await db
      .prepare(
        `INSERT INTO reports (id, task_id, order_id, created_by, started_at) VALUES (?, ?, ?, ?, datetime('now'))`
      )
      .bind(newId(), id, task.order_id, session.user.id)
      .run();

    await writeAuditLog({ userId: session.user.id, action: "START_TASK", entity: "task", entityId: id });

    const updated = await db.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(id).first();
    return NextResponse.json({ task: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
