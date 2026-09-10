import Link from "next/link";
import { DollarSign, Package, UserPlus, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import { getDb } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RevenueChart, type RevenuePoint } from "@/components/dashboard/revenue-chart";
import { StatusDistribution, type StatusCount } from "@/components/dashboard/status-distribution";
import { formatVnd } from "@/lib/utils";
import type { OrderStatus } from "@/types/db";

async function count(db: D1Database, sql: string, ...binds: unknown[]) {
  const row = await db.prepare(sql).bind(...binds).first<{ c: number }>();
  return row?.c ?? 0;
}

const ALL_STATUSES: OrderStatus[] = [
  "DRAFT",
  "CONFIRMED",
  "PACKING",
  "PACKED",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
];

export default async function DashboardPage() {
  const db = getDb();
  const session = await getSession();
  const today = new Date().toISOString().slice(0, 10);

  const [
    ordersToday,
    revenueTodayRow,
    newCustomersToday,
    avgOrderValueRow,
    overdueTasks,
    lowStockCount,
    { results: revenueRows },
    { results: statusRows },
  ] = await Promise.all([
    count(db, `SELECT COUNT(*) as c FROM orders WHERE date(created_at) = ?`, today),
    db
      .prepare(`SELECT COALESCE(SUM(total_amount),0) as v FROM orders WHERE date(created_at) = ? AND status != 'CANCELLED'`)
      .bind(today)
      .first<{ v: number }>(),
    count(db, `SELECT COUNT(*) as c FROM customers WHERE date(created_at) = ?`, today),
    db
      .prepare(`SELECT COALESCE(AVG(total_amount),0) as v FROM orders WHERE status != 'CANCELLED'`)
      .first<{ v: number }>(),
    count(
      db,
      `SELECT COUNT(*) as c FROM tasks WHERE status IN ('TODO','IN_PROGRESS') AND due_at IS NOT NULL AND due_at < datetime('now')`
    ),
    count(db, `SELECT COUNT(*) as c FROM inventory WHERE quantity_on_hand <= low_stock_threshold`),
    db
      .prepare(
        `SELECT date(created_at) as day, COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as orders
         FROM orders
         WHERE created_at >= datetime('now', '-6 days', 'start of day') AND status != 'CANCELLED'
         GROUP BY day`
      )
      .all<{ day: string; revenue: number; orders: number }>(),
    db.prepare(`SELECT status, COUNT(*) as c FROM orders GROUP BY status`).all<{ status: OrderStatus; c: number }>(),
  ]);

  // Fill in the last 7 days so the chart never has gaps for quiet days.
  const revenueByDay = new Map(revenueRows.map((r) => [r.day, r]));
  const revenueData: RevenuePoint[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const row = revenueByDay.get(key);
    return {
      label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      revenue: row?.revenue ?? 0,
      orders: row?.orders ?? 0,
    };
  });

  const statusByKey = new Map(statusRows.map((r) => [r.status, r.c]));
  const statusData: StatusCount[] = ALL_STATUSES.map((status) => ({
    status,
    count: statusByKey.get(status) ?? 0,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-stone-900">
          Xin chào, {session!.user.full_name.split(" ").pop()} 👋
        </h1>
        <p className="text-sm text-stone-500">
          Tổng quan hoạt động hôm nay —{" "}
          {new Intl.DateTimeFormat("vi-VN", { dateStyle: "full" }).format(new Date())}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={DollarSign} label="Doanh thu hôm nay" value={formatVnd(revenueTodayRow?.v ?? 0)} color="purple" />
        <KpiCard icon={Package} label="Đơn hôm nay" value={String(ordersToday)} color="emerald" />
        <KpiCard icon={UserPlus} label="Khách hàng mới" value={String(newCustomersToday)} color="blue" />
        <KpiCard icon={TrendingUp} label="Giá trị đơn TB" value={formatVnd(Math.round(avgOrderValueRow?.v ?? 0))} color="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Doanh thu 7 ngày qua</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Phân bố trạng thái đơn</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDistribution data={statusData} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href="/tasks">
          <Card className="p-4 hover:border-amber-300">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs text-stone-500">Task quá hạn</div>
                <div className="font-bold text-stone-900">{overdueTasks}</div>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/inventory">
          <Card className="p-4 hover:border-amber-300">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs text-stone-500">SKU sắp hết</div>
                <div className="font-bold text-stone-900">{lowStockCount}</div>
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
