import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { TaskDetailClient } from "@/components/tasks/task-detail-client";
import type {
  CustomerRow,
  OrderItemRow,
  OrderRow,
  ReportImageRow,
  TaskChecklistRow,
  TaskRow,
} from "@/types/db";

export default async function TaskDetailPage({ params }: PageProps<"/my-tasks/[id]">) {
  const { id } = await params;
  const session = await getSession();
  const db = getDb();

  const task = await db.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(id).first<TaskRow>();
  if (!task) notFound();
  if (session!.user.role === "EMPLOYEE" && task.assigned_to !== session!.user.id) notFound();

  const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(task.order_id).first<OrderRow>();
  if (!order) notFound();

  const [{ results: items }, { results: checklist }, customer, { results: images }] = await Promise.all([
    db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).bind(order.id).all<OrderItemRow>(),
    db
      .prepare(`SELECT * FROM task_checklists WHERE task_id = ? ORDER BY sort_order ASC`)
      .bind(id)
      .all<TaskChecklistRow>(),
    db.prepare(`SELECT * FROM customers WHERE id = ?`).bind(order.customer_id).first<CustomerRow>(),
    db
      .prepare(`SELECT * FROM report_images WHERE task_id = ? ORDER BY created_at ASC`)
      .bind(id)
      .all<ReportImageRow>(),
  ]);

  return (
    <TaskDetailClient
      task={task}
      order={order}
      items={items}
      checklist={checklist}
      customer={customer}
      images={images}
      employeeName={session!.user.full_name}
    />
  );
}
