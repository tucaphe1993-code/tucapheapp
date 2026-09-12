import {
  DollarSign,
  TrendingUp,
  HandCoins,
  Wallet,
  Package,
  ClipboardList,
  Clock,
  Truck,
  Wrench,
  PackageX,
} from "lucide-react";
import { getDb } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RevenueChart, type RevenuePoint } from "@/components/dashboard/revenue-chart";
import { OrderStatusBuckets } from "@/components/dashboard/order-status-buckets";
import { TopProductsCard } from "@/components/dashboard/top-products-card";
import { ActionCenter, type ActionCenterItem } from "@/components/dashboard/action-center";
import { CoffeeStockCard } from "@/components/dashboard/coffee-stock-card";
import { DeviceSummaryCard } from "@/components/dashboard/device-summary-card";
import { formatVnd } from "@/lib/utils";
import {
  getPeriodRange,
  deltaPercent,
  getRevenueProfitTotals,
  getRevenueSeries,
  getDebtSummary,
  getOrderStatusBuckets,
  getTopProducts,
  getDeviceStatusCounts,
  getCoffeeStock,
  getActionCenterCounts,
  getTaskSummary,
  type DashboardPeriod,
  type TopProductCategory,
} from "@/lib/services/dashboard";

const PERIOD_LABEL: Record<DashboardPeriod, string> = {
  "7d": "7 ngày",
  "30d": "30 ngày",
  this_month: "Tháng này",
  last_month: "Tháng trước",
};
const PERIODS: DashboardPeriod[] = ["7d", "30d", "this_month", "last_month"];
const TOP_CATEGORIES: TopProductCategory[] = ["ALL", "COFFEE", "OTHER"];

function deltaText(current: number, previous: number, unit: (n: number) => string) {
  const pct = deltaPercent(current, previous);
  if (pct === null) return previous === 0 && current > 0 ? "Hôm qua chưa có doanh thu để so sánh" : undefined;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}% so với hôm qua (${unit(previous)})`;
}

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  const period: DashboardPeriod = PERIODS.includes(sp.period as DashboardPeriod) ? (sp.period as DashboardPeriod) : "7d";
  const metric: "revenue" | "profit" = sp.metric === "profit" ? "profit" : "revenue";
  const topTab: TopProductCategory = TOP_CATEGORIES.includes(sp.topTab as TopProductCategory)
    ? (sp.topTab as TopProductCategory)
    : "ALL";

  function dashboardHref(overrides: Partial<{ period: DashboardPeriod; metric: string; topTab: TopProductCategory }>) {
    const merged = { period, metric, topTab, ...overrides };
    const params = new URLSearchParams({ period: merged.period, metric: merged.metric, topTab: merged.topTab });
    return `/dashboard?${params.toString()}`;
  }

  const db = getDb();
  const session = await getSession();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterdayDate = new Date(now);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);
  const { start, end, prevStart, prevEnd } = getPeriodRange(period, now);

  const [
    todayTotals,
    yesterdayTotals,
    paidTodayRow,
    ordersTodayRow,
    debtSummary,
    orderBuckets,
    taskSummary,
    actionCounts,
    seriesRaw,
    periodTotals,
    prevPeriodTotals,
    topProducts,
    deviceCounts,
    coffeeStock,
  ] = await Promise.all([
    getRevenueProfitTotals(db, today, today),
    getRevenueProfitTotals(db, yesterday, yesterday),
    db.prepare(`SELECT COALESCE(SUM(amount),0) as v FROM payments WHERE date(paid_at) = ?`).bind(today).first<{ v: number }>(),
    db.prepare(`SELECT COUNT(*) as c FROM orders WHERE date(created_at) = ?`).bind(today).first<{ c: number }>(),
    getDebtSummary(db),
    getOrderStatusBuckets(db),
    getTaskSummary(db),
    getActionCenterCounts(db),
    getRevenueSeries(db, start, end),
    getRevenueProfitTotals(db, start, end),
    getRevenueProfitTotals(db, prevStart, prevEnd),
    getTopProducts(db, topTab, start, end),
    getDeviceStatusCounts(db),
    getCoffeeStock(db),
  ]);

  const revenueData: RevenuePoint[] = seriesRaw.map((r) => {
    const [, m, d] = r.day.split("-");
    return { label: `${d}/${m}`, revenue: r.revenue, profit: r.profit };
  });

  const paidToday = paidTodayRow?.v ?? 0;
  const margin = todayTotals.revenue > 0 ? (todayTotals.profit / todayTotals.revenue) * 100 : null;
  const collectedShare = todayTotals.revenue > 0 ? (paidToday / todayTotals.revenue) * 100 : null;
  const inProgressOrders = orderBuckets.confirmed + orderBuckets.packing;
  const revenueDeltaPct = deltaPercent(todayTotals.revenue, yesterdayTotals.revenue);

  const periodDelta = deltaPercent(periodTotals[metric], prevPeriodTotals[metric]);

  const topProductTabs = TOP_CATEGORIES.map((value) => ({
    value,
    href: dashboardHref({ topTab: value }),
    active: value === topTab,
  }));

  const actionItems: ActionCenterItem[] = [
    {
      key: "overdue_debt",
      icon: Wallet,
      count: debtSummary.overdueCount,
      label: "công nợ quá hạn",
      href: "/debts",
      severity: "high",
    },
    {
      key: "overdue_tasks",
      icon: Clock,
      count: taskSummary.overdue,
      label: "task quá hạn",
      href: "/tasks",
      severity: "high",
    },
    {
      key: "unshipped_orders",
      icon: Truck,
      count: actionCounts.unshippedOrders,
      label: "đơn chưa giao",
      href: "/orders",
      severity: "medium",
    },
    {
      key: "uninstalled_devices",
      icon: Wrench,
      count: actionCounts.uninstalledDevices,
      label: "máy chưa lắp đặt",
      href: "/devices",
      severity: "medium",
    },
    {
      key: "low_stock",
      icon: PackageX,
      count: actionCounts.lowStockCount,
      label: "SKU sắp hết hàng",
      href: "/inventory",
      severity: "medium",
    },
  ];

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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          icon={DollarSign}
          label="Doanh thu hôm nay"
          value={formatVnd(todayTotals.revenue)}
          color="purple"
          sub={deltaText(todayTotals.revenue, yesterdayTotals.revenue, formatVnd)}
          subTone={revenueDeltaPct === null ? "neutral" : revenueDeltaPct >= 0 ? "positive" : "negative"}
        />
        <KpiCard
          icon={TrendingUp}
          label="Lợi nhuận gộp"
          value={formatVnd(todayTotals.profit)}
          color="emerald"
          sub={margin === null ? undefined : `Margin ${margin.toFixed(1)}%`}
          subTone="neutral"
        />
        <KpiCard
          icon={HandCoins}
          label="Đã thu"
          value={formatVnd(paidToday)}
          color="blue"
          sub={collectedShare === null ? undefined : `${collectedShare.toFixed(0)}% doanh thu hôm nay`}
          subTone="neutral"
          href="/debts"
        />
        <KpiCard
          icon={Wallet}
          label="Công nợ phải thu"
          value={formatVnd(debtSummary.totalDebt)}
          color={debtSummary.overdueCount > 0 ? "red" : "amber"}
          sub={debtSummary.overdueCount > 0 ? `${debtSummary.overdueCount} đơn quá hạn` : "Không có nợ quá hạn"}
          subTone={debtSummary.overdueCount > 0 ? "negative" : "neutral"}
          href="/debts"
        />
        <KpiCard
          icon={Package}
          label="Đơn hàng hôm nay"
          value={String(ordersTodayRow?.c ?? 0)}
          color="amber"
          sub={`${inProgressOrders} đơn đang xử lý`}
          subTone="neutral"
          href="/orders"
        />
        <KpiCard
          icon={ClipboardList}
          label="Việc cần xử lý"
          value={String(taskSummary.open)}
          color={taskSummary.overdue > 0 ? "red" : "stone"}
          sub={taskSummary.overdue > 0 ? `${taskSummary.overdue} việc quá hạn` : "Không có việc quá hạn"}
          subTone={taskSummary.overdue > 0 ? "negative" : "neutral"}
          href="/tasks"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Doanh thu</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-full bg-stone-100 p-1">
                {PERIODS.map((p) => (
                  <a
                    key={p}
                    href={dashboardHref({ period: p })}
                    className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                      p === period ? "bg-amber-800 text-white" : "text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {PERIOD_LABEL[p]}
                  </a>
                ))}
              </div>
              <div className="flex gap-1 rounded-full bg-stone-100 p-1">
                {(["revenue", "profit"] as const).map((m) => (
                  <a
                    key={m}
                    href={dashboardHref({ metric: m })}
                    className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                      m === metric ? "bg-amber-800 text-white" : "text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {m === "revenue" ? "Doanh thu" : "Lợi nhuận"}
                  </a>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-stone-900">{formatVnd(periodTotals[metric])}</span>
              {periodDelta !== null && (
                <span className={`text-sm font-medium ${periodDelta >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {periodDelta >= 0 ? "+" : ""}
                  {periodDelta.toFixed(1)}% so với kỳ trước
                </span>
              )}
            </div>
            <RevenueChart data={revenueData} metric={metric} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Đơn hàng</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderStatusBuckets data={orderBuckets} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top sản phẩm bán chạy ({PERIOD_LABEL[period]})</CardTitle>
          </CardHeader>
          <CardContent>
            <TopProductsCard items={topProducts} tabs={topProductTabs} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cần xử lý hôm nay</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionCenter items={actionItems} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">☕ Kho cà phê</CardTitle>
          </CardHeader>
          <CardContent>
            <CoffeeStockCard finishedKg={coffeeStock.finishedKg} lowStockCount={coffeeStock.lowStockCount} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">⚙️ Thiết bị</CardTitle>
          </CardHeader>
          <CardContent>
            <DeviceSummaryCard counts={deviceCounts} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
