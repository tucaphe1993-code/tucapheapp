import type { DeviceStatus, OrderStatus } from "@/types/db";

export type DashboardPeriod = "7d" | "30d" | "this_month" | "last_month";

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateStr(d);
}

function daysBetween(startStr: string, endStr: string): number {
  const start = new Date(`${startStr}T00:00:00Z`).getTime();
  const end = new Date(`${endStr}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86400000);
}

export interface PeriodRange {
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
}

/**
 * Khoảng ngày cho bộ lọc doanh thu + khoảng liền trước có cùng độ dài để so
 * sánh ("kỳ trước"). Mọi mốc đều theo lịch UTC (khớp cách `date(created_at)`
 * của SQLite/D1 tính ngày), giống quy ước "hôm nay" đã dùng sẵn trong app.
 */
export function getPeriodRange(period: DashboardPeriod, now: Date = new Date()): PeriodRange {
  const todayStr = toDateStr(now);
  let start: string;
  let end: string;

  if (period === "7d") {
    end = todayStr;
    start = addDays(todayStr, -6);
  } else if (period === "30d") {
    end = todayStr;
    start = addDays(todayStr, -29);
  } else if (period === "this_month") {
    end = todayStr;
    start = `${todayStr.slice(0, 7)}-01`;
  } else {
    const firstOfThisMonth = `${todayStr.slice(0, 7)}-01`;
    end = addDays(firstOfThisMonth, -1);
    start = `${end.slice(0, 7)}-01`;
  }

  const spanDays = daysBetween(start, end) + 1;
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(spanDays - 1));

  return { start, end, prevStart, prevEnd };
}

/** % thay đổi so với kỳ trước. Trả về null khi không có nền để so sánh (kỳ trước = 0). */
export function deltaPercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export interface RevenueProfitTotals {
  revenue: number;
  profit: number;
}

export async function getRevenueProfitTotals(
  db: D1Database,
  start: string,
  end: string
): Promise<RevenueProfitTotals> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(oi.line_total),0) as revenue,
              COALESCE(SUM(oi.line_total - oi.quantity * pv.cost_price),0) as profit
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN product_variants pv ON pv.id = oi.product_variant_id
       WHERE o.status != 'CANCELLED' AND date(o.created_at) BETWEEN ? AND ?`
    )
    .bind(start, end)
    .first<RevenueProfitTotals>();
  return { revenue: row?.revenue ?? 0, profit: row?.profit ?? 0 };
}

export interface RevenueSeriesPoint {
  day: string;
  revenue: number;
  profit: number;
}

/** Doanh thu + lợi nhuận theo từng ngày trong khoảng, KHÔNG có ngày trống (fill 0). */
export async function getRevenueSeries(db: D1Database, start: string, end: string): Promise<RevenueSeriesPoint[]> {
  const { results } = await db
    .prepare(
      `SELECT date(o.created_at) as day,
              COALESCE(SUM(oi.line_total),0) as revenue,
              COALESCE(SUM(oi.line_total - oi.quantity * pv.cost_price),0) as profit
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN product_variants pv ON pv.id = oi.product_variant_id
       WHERE o.status != 'CANCELLED' AND date(o.created_at) BETWEEN ? AND ?
       GROUP BY day`
    )
    .bind(start, end)
    .all<RevenueSeriesPoint>();

  const byDay = new Map(results.map((r) => [r.day, r]));
  const days = daysBetween(start, end) + 1;
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(start, i);
    const row = byDay.get(day);
    return { day, revenue: row?.revenue ?? 0, profit: row?.profit ?? 0 };
  });
}

export interface DebtSummary {
  totalDebt: number;
  overdueDebt: number;
  overdueCount: number;
}

/** Công nợ phải thu toàn hệ thống — tính trực tiếp từ orders - payments, không lưu cột riêng (giống trang Công nợ). */
export async function getDebtSummary(db: D1Database): Promise<DebtSummary> {
  const row = await db
    .prepare(
      `SELECT
         COALESCE(SUM(MAX(o.total_amount - COALESCE(p.paid, 0), 0)), 0) as total_debt,
         COALESCE(SUM(CASE WHEN o.payment_due_date IS NOT NULL AND o.payment_due_date < date('now')
                            THEN MAX(o.total_amount - COALESCE(p.paid, 0), 0) ELSE 0 END), 0) as overdue_debt,
         COALESCE(SUM(CASE WHEN o.payment_due_date IS NOT NULL AND o.payment_due_date < date('now')
                            AND (o.total_amount - COALESCE(p.paid, 0)) > 0 THEN 1 ELSE 0 END), 0) as overdue_count
       FROM orders o
       LEFT JOIN (SELECT order_id, SUM(amount) as paid FROM payments GROUP BY order_id) p ON p.order_id = o.id
       WHERE o.status != 'CANCELLED'`
    )
    .first<{ total_debt: number; overdue_debt: number; overdue_count: number }>();
  return {
    totalDebt: row?.total_debt ?? 0,
    overdueDebt: row?.overdue_debt ?? 0,
    overdueCount: row?.overdue_count ?? 0,
  };
}

export interface OrderStatusBuckets {
  confirmed: number;
  packing: number;
  shipped: number;
  cancelled: number;
  total: number;
}

/**
 * Gộp 7 trạng thái đơn thật của hệ thống thành 4 nhóm vận hành cho Dashboard
 * (DRAFT không tính — đơn nháp chưa thật sự là cam kết bán hàng):
 * Đã xác nhận / Đang đóng gói (PACKING+PACKED) / Đã giao (SHIPPED+COMPLETED) / Đã hủy.
 */
export async function getOrderStatusBuckets(db: D1Database): Promise<OrderStatusBuckets> {
  const { results } = await db
    .prepare(`SELECT status, COUNT(*) as c FROM orders GROUP BY status`)
    .all<{ status: OrderStatus; c: number }>();
  const byStatus = new Map(results.map((r) => [r.status, r.c]));
  const confirmed = byStatus.get("CONFIRMED") ?? 0;
  const packing = (byStatus.get("PACKING") ?? 0) + (byStatus.get("PACKED") ?? 0);
  const shipped = (byStatus.get("SHIPPED") ?? 0) + (byStatus.get("COMPLETED") ?? 0);
  const cancelled = byStatus.get("CANCELLED") ?? 0;
  return { confirmed, packing, shipped, cancelled, total: confirmed + packing + shipped + cancelled };
}

export type TopProductCategory = "ALL" | "COFFEE" | "OTHER";

export interface TopProductItem {
  variantId: string;
  label: string;
  quantity: number;
  revenue: number;
  share: number;
}

interface TopProductRow {
  variant_id: string;
  product_name: string;
  product_type: string;
  weight_grams: number | null;
  model: string | null;
  qty: number;
  revenue: number;
}

/** Top SKU theo doanh thu trong khoảng thời gian. `share` = % trên tổng doanh thu của TOÀN BỘ nhóm (không chỉ top N). */
export async function getTopProducts(
  db: D1Database,
  category: TopProductCategory,
  start: string,
  end: string,
  limit = 5
): Promise<TopProductItem[]> {
  const typeFilter =
    category === "COFFEE" ? `AND p.product_type = 'COFFEE'` : category === "OTHER" ? `AND p.product_type != 'COFFEE'` : "";

  const { results } = await db
    .prepare(
      `SELECT pv.id as variant_id, p.name as product_name, p.product_type, pv.weight_grams, pv.model,
              SUM(oi.quantity) as qty, SUM(oi.line_total) as revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN product_variants pv ON pv.id = oi.product_variant_id
       JOIN products p ON p.id = pv.product_id
       WHERE o.status != 'CANCELLED' AND date(o.created_at) BETWEEN ? AND ? ${typeFilter}
       GROUP BY pv.id
       ORDER BY revenue DESC`
    )
    .bind(start, end)
    .all<TopProductRow>();

  const totalRevenue = results.reduce((s, r) => s + r.revenue, 0);

  return results.slice(0, limit).map((r) => {
    let label = r.product_name;
    if (r.product_type === "COFFEE" && r.weight_grams != null) {
      label += ` ${r.weight_grams >= 1000 ? `${r.weight_grams / 1000}kg` : `${r.weight_grams}g`}`;
    } else if (r.model && r.model !== r.product_name) {
      label += ` (${r.model})`;
    }
    return {
      variantId: r.variant_id,
      label,
      quantity: r.qty,
      revenue: r.revenue,
      share: totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0,
    };
  });
}

export async function getDeviceStatusCounts(db: D1Database): Promise<Partial<Record<DeviceStatus, number>>> {
  const { results } = await db
    .prepare(`SELECT status, COUNT(*) as c FROM devices GROUP BY status`)
    .all<{ status: DeviceStatus; c: number }>();
  return Object.fromEntries(results.map((r) => [r.status, r.c]));
}

export interface CoffeeStock {
  finishedKg: number;
  lowStockCount: number;
}

/**
 * Chỉ tính được lượng cà phê THÀNH PHẨM (đã đóng gói, theo dõi trong bảng
 * inventory) — hệ thống hiện chưa theo dõi nguyên liệu cà phê nhân xanh hay
 * công thức sản xuất nên KHÔNG suy ra được "sản lượng có thể sản xuất";
 * 2 chỉ số đó phải hiển thị "Chưa có dữ liệu" ở UI thay vì bịa số.
 */
export async function getCoffeeStock(db: D1Database): Promise<CoffeeStock> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(inv.quantity_on_hand * pv.weight_grams), 0) as total_grams,
              COALESCE(SUM(CASE WHEN inv.quantity_on_hand <= inv.low_stock_threshold THEN 1 ELSE 0 END), 0) as low_stock
       FROM inventory inv
       JOIN product_variants pv ON pv.id = inv.product_variant_id
       JOIN products p ON p.id = pv.product_id
       WHERE p.product_type = 'COFFEE'`
    )
    .first<{ total_grams: number; low_stock: number }>();
  return { finishedKg: (row?.total_grams ?? 0) / 1000, lowStockCount: row?.low_stock ?? 0 };
}

export interface ActionCenterCounts {
  overdueTasks: number;
  unshippedOrders: number;
  uninstalledDevices: number;
  lowStockCount: number;
}

/** Đếm thô cho khu "Cần xử lý hôm nay" — công nợ quá hạn lấy từ getDebtSummary để khỏi truy vấn trùng. */
export async function getActionCenterCounts(db: D1Database): Promise<ActionCenterCounts> {
  const [overdueTasks, unshippedOrders, uninstalledDevices, lowStockCount] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) as c FROM tasks WHERE status IN ('TODO','IN_PROGRESS') AND due_at IS NOT NULL AND due_at < datetime('now')`
      )
      .first<{ c: number }>(),
    db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status IN ('CONFIRMED','PACKING','PACKED')`).first<{ c: number }>(),
    db.prepare(`SELECT COUNT(*) as c FROM devices WHERE status IN ('SOLD','AWAITING_INSTALL')`).first<{ c: number }>(),
    db.prepare(`SELECT COUNT(*) as c FROM inventory WHERE quantity_on_hand <= low_stock_threshold`).first<{ c: number }>(),
  ]);
  return {
    overdueTasks: overdueTasks?.c ?? 0,
    unshippedOrders: unshippedOrders?.c ?? 0,
    uninstalledDevices: uninstalledDevices?.c ?? 0,
    lowStockCount: lowStockCount?.c ?? 0,
  };
}

export interface TaskSummary {
  open: number;
  overdue: number;
}

export async function getTaskSummary(db: D1Database): Promise<TaskSummary> {
  const row = await db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status IN ('TODO','IN_PROGRESS') THEN 1 ELSE 0 END),0) as open_count,
         COALESCE(SUM(CASE WHEN status IN ('TODO','IN_PROGRESS') AND due_at IS NOT NULL AND due_at < datetime('now') THEN 1 ELSE 0 END),0) as overdue_count
       FROM tasks`
    )
    .first<{ open_count: number; overdue_count: number }>();
  return { open: row?.open_count ?? 0, overdue: row?.overdue_count ?? 0 };
}
