import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function count(db: D1Database, sql: string, ...binds: unknown[]) {
  const row = await db.prepare(sql).bind(...binds).first<{ c: number }>();
  return row?.c ?? 0;
}

export default async function DashboardPage() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const [
    ordersToday,
    pendingPack,
    packing,
    packed,
    shipped,
    overdueTasks,
    lowStockCount,
    totalInventory,
  ] = await Promise.all([
    count(db, `SELECT COUNT(*) as c FROM orders WHERE date(created_at) = ?`, today),
    count(db, `SELECT COUNT(*) as c FROM orders WHERE status = 'CONFIRMED'`),
    count(db, `SELECT COUNT(*) as c FROM orders WHERE status = 'PACKING'`),
    count(db, `SELECT COUNT(*) as c FROM orders WHERE status = 'PACKED'`),
    count(db, `SELECT COUNT(*) as c FROM orders WHERE status = 'SHIPPED'`),
    count(
      db,
      `SELECT COUNT(*) as c FROM tasks WHERE status IN ('TODO','IN_PROGRESS') AND due_at IS NOT NULL AND due_at < datetime('now')`
    ),
    count(db, `SELECT COUNT(*) as c FROM inventory WHERE quantity_on_hand <= low_stock_threshold`),
    count(db, `SELECT COALESCE(SUM(quantity_on_hand),0) as c FROM inventory`),
  ]);

  const cards = [
    { label: "Đơn hôm nay", value: ordersToday, href: "/orders", icon: "📦" },
    { label: "Đơn chờ đóng", value: pendingPack, href: "/orders?status=CONFIRMED", icon: "🕒" },
    { label: "Đơn đang đóng", value: packing, href: "/orders?status=PACKING", icon: "🧰" },
    { label: "Đơn đã đóng", value: packed, href: "/orders?status=PACKED", icon: "✅" },
    { label: "Đơn đã giao", value: shipped, href: "/orders?status=SHIPPED", icon: "🚚" },
    { label: "Task quá hạn", value: overdueTasks, href: "/tasks", icon: "⏰" },
    { label: "SKU sắp hết", value: lowStockCount, href: "/inventory", icon: "⚠️" },
    { label: "Tổng tồn kho", value: totalInventory, href: "/inventory", icon: "🏬" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-stone-900">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href}>
            <Card className="hover:border-amber-300">
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center justify-between text-sm font-normal text-stone-500">
                  {c.label} <span>{c.icon}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-stone-900">{c.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
