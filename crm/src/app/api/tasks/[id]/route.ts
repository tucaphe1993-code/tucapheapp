import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { handleApiError, ForbiddenError, NotFoundError } from "@/lib/api/errors";
import type { OrderItemRow, OrderRow, TaskChecklistRow, TaskRow } from "@/types/db";

export async function GET(_req: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  try {
    const session = await requireRole("ADMIN", "EMPLOYEE");
    const { id } = await ctx.params;
    const db = getDb();

    const task = await db.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(id).first<TaskRow>();
    if (!task) throw new NotFoundError("Không tìm thấy công việc");
    if (session.user.role === "EMPLOYEE" && task.assigned_to !== session.user.id) {
      throw new ForbiddenError();
    }

    const [order, { results: items }, { results: checklist }] = await Promise.all([
      db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(task.order_id).first<OrderRow>(),
      db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).bind(task.order_id).all<OrderItemRow>(),
      db
        .prepare(`SELECT * FROM task_checklists WHERE task_id = ? ORDER BY sort_order ASC`)
        .bind(id)
        .all<TaskChecklistRow>(),
    ]);

    const customer = order
      ? await db.prepare(`SELECT * FROM customers WHERE id = ?`).bind(order.customer_id).first()
      : null;

    return NextResponse.json({ task, order, items, checklist, customer });
  } catch (err) {
    return handleApiError(err);
  }
}
