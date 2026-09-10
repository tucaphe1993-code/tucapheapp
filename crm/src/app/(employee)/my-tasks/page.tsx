import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { TaskPriorityBadge } from "@/components/tasks/task-status-badge";
import { formatDateTime } from "@/lib/utils";
import type { TaskRow } from "@/types/db";

interface TaskWithOrder extends TaskRow {
  customer_name: string;
  item_count: number;
  total_qty: number;
}

const SECTIONS: { status: TaskRow["status"]; icon: string; title: string }[] = [
  { status: "TODO", icon: "🔴", title: "CẦN LÀM" },
  { status: "IN_PROGRESS", icon: "🟡", title: "ĐANG LÀM" },
  { status: "COMPLETED", icon: "🟢", title: "HOÀN THÀNH" },
];

export default async function MyTasksPage() {
  const session = await getSession();
  const db = getDb();

  const { results: tasks } = await db
    .prepare(
      `SELECT t.*, c.name as customer_name,
              (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
              (SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id = o.id) as total_qty
       FROM tasks t
       JOIN orders o ON o.id = t.order_id
       JOIN customers c ON c.id = o.customer_id
       WHERE t.assigned_to = ? AND t.status != 'CANCELLED'
       ORDER BY t.created_at DESC`
    )
    .bind(session!.user.id)
    .all<TaskWithOrder>();

  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <div className="text-lg font-bold text-stone-900">👋 Xin chào, {session!.user.full_name}</div>
        <div className="text-sm text-stone-500">Việc của tôi</div>
      </div>

      {SECTIONS.map((section) => {
        const items = tasks.filter((t) => t.status === section.status);
        return (
          <div key={section.status} className="flex flex-col gap-2">
            <div className="text-sm font-semibold text-stone-700">
              {section.icon} {section.title} ({items.length})
            </div>
            {items.length === 0 && (
              <div className="rounded-lg border border-dashed border-stone-300 p-4 text-center text-sm text-stone-400">
                Không có việc nào
              </div>
            )}
            {items.map((t) => (
              <Link key={t.id} href={`/my-tasks/${t.id}`}>
                <Card className="active:scale-[0.99] transition-transform">
                  <CardContent className="py-3">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="font-semibold">{t.customer_name}</div>
                      <TaskPriorityBadge priority={t.priority} />
                    </div>
                    <div className="text-sm text-stone-600">
                      {t.item_count} sản phẩm · {t.total_qty} đơn vị
                    </div>
                    {t.due_at && (
                      <div className="mt-1 text-xs text-stone-400">Hạn: {formatDateTime(t.due_at)}</div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        );
      })}
    </div>
  );
}
