import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { formatDate, formatVnd } from "@/lib/utils";
import type { OrderRow } from "@/types/db";

export default async function MyOrdersPage() {
  const session = await getSession();
  const db = getDb();

  const { results: orders } = await db
    .prepare(
      `SELECT DISTINCT o.* FROM orders o
       JOIN tasks t ON t.order_id = o.id
       WHERE t.assigned_to = ?
       ORDER BY o.created_at DESC`
    )
    .bind(session!.user.id)
    .all<OrderRow>();

  return (
    <div className="flex flex-col gap-3 p-4">
      <h1 className="text-lg font-bold">Đơn hàng liên quan</h1>
      {orders.length === 0 && (
        <div className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">
          Chưa có đơn hàng nào
        </div>
      )}
      {orders.map((o) => (
        <Link key={o.id} href={`/my-tasks?order=${o.id}`}>
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{o.order_code}</div>
                <OrderStatusBadge status={o.status} />
              </div>
              <div className="text-sm text-stone-500">{formatDate(o.created_at)}</div>
              <div className="text-sm font-medium">{formatVnd(o.total_amount)}</div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
