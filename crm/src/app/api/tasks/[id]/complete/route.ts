import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { ReportRow, TaskChecklistRow, TaskRow } from "@/types/db";

const bodySchema = z.object({ note: z.string().trim().optional() });

export async function POST(req: NextRequest, ctx: RouteContext<"/api/tasks/[id]/complete">) {
  try {
    const session = await requireRole("ADMIN", "EMPLOYEE");
    const { id } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }

    const db = getDb();
    const task = await db.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(id).first<TaskRow>();
    if (!task) throw new NotFoundError("Không tìm thấy công việc");
    if (session.user.role === "EMPLOYEE" && task.assigned_to !== session.user.id) {
      throw new ForbiddenError();
    }
    if (task.status !== "IN_PROGRESS") {
      throw new ValidationError("Công việc phải đang thực hiện mới hoàn thành được");
    }

    const { results: checklist } = await db
      .prepare(`SELECT * FROM task_checklists WHERE task_id = ?`)
      .bind(id)
      .all<TaskChecklistRow>();
    const uncheckedRequired = checklist.filter((c) => c.is_required && !c.is_checked);
    if (uncheckedRequired.length > 0) {
      throw new ValidationError(
        `Còn ${uncheckedRequired.length} mục checklist bắt buộc chưa hoàn thành: ${uncheckedRequired
          .map((c) => c.label)
          .join(", ")}`
      );
    }

    const report = await db
      .prepare(`SELECT * FROM reports WHERE task_id = ?`)
      .bind(id)
      .first<ReportRow>();
    if (!report) throw new ValidationError("Không tìm thấy báo cáo cho công việc này");

    const cas = await db
      .prepare(
        `UPDATE tasks SET status = 'COMPLETED', completed_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ? AND status = 'IN_PROGRESS'`
      )
      .bind(id)
      .run();
    if (!cas.meta.changes) throw new ValidationError("Công việc đã hoàn thành trước đó");

    await db
      .prepare(
        `UPDATE reports SET note = ?, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
      )
      .bind(parsed.data.note || null, report.id)
      .run();

    await db
      .prepare(
        `UPDATE orders SET status = 'PACKED', updated_at = datetime('now') WHERE id = ? AND status = 'PACKING'`
      )
      .bind(task.order_id)
      .run();

    await writeAuditLog({ userId: session.user.id, action: "COMPLETE_TASK", entity: "task", entityId: id });

    const updated = await db.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(id).first();
    return NextResponse.json({ task: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
