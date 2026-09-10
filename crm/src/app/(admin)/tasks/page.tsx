import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { formatDateTime } from "@/lib/utils";
import type { TaskRow } from "@/types/db";

interface TaskRowJoined extends TaskRow {
  order_code: string;
  assignee_name: string;
  is_overdue: number;
}

const OVERDUE_SQL = `(t.due_at IS NOT NULL AND t.status NOT IN ('COMPLETED','CANCELLED') AND t.due_at < datetime('now')) as is_overdue`;

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const { status } = await searchParams;
  const db = getDb();

  const stmt = status
    ? db
        .prepare(
          `SELECT t.*, o.order_code as order_code, u.full_name as assignee_name, ${OVERDUE_SQL}
           FROM tasks t JOIN orders o ON o.id = t.order_id JOIN users u ON u.id = t.assigned_to
           WHERE t.status = ? ORDER BY t.created_at DESC`
        )
        .bind(status)
    : db.prepare(
        `SELECT t.*, o.order_code as order_code, u.full_name as assignee_name, ${OVERDUE_SQL}
         FROM tasks t JOIN orders o ON o.id = t.order_id JOIN users u ON u.id = t.assigned_to
         ORDER BY t.created_at DESC LIMIT 300`
      );
  const { results: tasks } = await stmt.all<TaskRowJoined>();

  const tabs = [
    { label: "Tất cả", value: "" },
    { label: "Cần làm", value: "TODO" },
    { label: "Đang làm", value: "IN_PROGRESS" },
    { label: "Hoàn thành", value: "COMPLETED" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-stone-900">Công việc</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={t.value ? `/tasks?status=${t.value}` : "/tasks"}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              (status ?? "") === t.value
                ? "bg-amber-800 text-white"
                : "bg-white text-stone-600 border border-stone-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {tasks.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-stone-500">Không có công việc</CardContent>
          </Card>
        )}
        {tasks.map((t) => {
          const overdue = !!t.is_overdue;
          return (
            <Link key={t.id} href={`/orders/${t.order_id}`}>
              <Card className={overdue ? "border-red-300" : undefined}>
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{t.order_code}</div>
                    <div className="text-sm text-stone-500">Giao cho: {t.assignee_name}</div>
                    {t.due_at && (
                      <div className={`text-xs ${overdue ? "text-red-600 font-medium" : "text-stone-400"}`}>
                        Hạn: {formatDateTime(t.due_at)} {overdue && "· QUÁ HẠN"}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <TaskPriorityBadge priority={t.priority} />
                    <TaskStatusBadge status={t.status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
