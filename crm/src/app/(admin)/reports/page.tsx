import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { formatVnd } from "@/lib/utils";
import { DollarSign, TrendingUp, ShoppingCart, HandCoins, Percent, ClipboardList } from "lucide-react";

const TABS = [
  { value: "sales", label: "Bán hàng" },
  { value: "revenue", label: "Doanh thu" },
  { value: "purchasing", label: "Mua hàng" },
  { value: "stock", label: "NXT tổng hợp" },
  { value: "cash", label: "Quỹ" },
  { value: "profit", label: "Lợi nhuận" },
  { value: "monthly", label: "Theo tháng" },
  { value: "analysis", label: "Phân tích KD" },
] as const;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthsAgo(n: number): Date {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return d;
}

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const sp = await searchParams;
  const tab = (Array.isArray(sp.tab) ? sp.tab[0] : sp.tab) || "sales";
  const from = (Array.isArray(sp.from) ? sp.from[0] : sp.from) || isoDate(monthsAgo(1));
  const to = (Array.isArray(sp.to) ? sp.to[0] : sp.to) || isoDate(new Date());
  const db = getDb();

  const filterBar = (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3 py-3">
        <form className="flex flex-wrap items-end gap-3" action="/reports" method="get">
          <input type="hidden" name="tab" value={tab} />
          <div className="flex flex-col gap-1">
            <Label htmlFor="from" className="text-xs">
              Từ ngày
            </Label>
            <Input id="from" name="from" type="date" defaultValue={from} className="h-9" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="to" className="text-xs">
              Đến ngày
            </Label>
            <Input id="to" name="to" type="date" defaultValue={to} className="h-9" />
          </div>
          <Button type="submit" size="sm">
            Áp dụng
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  const tabsNav = (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {TABS.map((t) => (
        <Link
          key={t.value}
          href={`/reports?tab=${t.value}&from=${from}&to=${to}`}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
            tab === t.value ? "bg-amber-800 text-white" : "bg-white text-stone-600 border border-stone-200"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );

  let body: React.ReactNode = null;

  if (tab === "sales") {
    interface Row {
      order_code: string;
      created_at: string;
      customer_name: string;
      sku: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      line_total: number;
      cost_total: number;
    }
    const { results } = await db
      .prepare(
        `SELECT o.order_code, o.created_at, c.name as customer_name, oi.sku, oi.product_name, oi.quantity, oi.unit_price,
                oi.line_total, (oi.quantity * pv.cost_price) as cost_total
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         JOIN customers c ON c.id = o.customer_id
         JOIN product_variants pv ON pv.id = oi.product_variant_id
         WHERE o.status != 'CANCELLED' AND substr(o.created_at,1,10) BETWEEN ? AND ?
         ORDER BY o.created_at DESC LIMIT 500`
      )
      .bind(from, to)
      .all<Row>();

    const revenue = results.reduce((s, r) => s + r.line_total, 0);
    const cost = results.reduce((s, r) => s + r.cost_total, 0);
    const orderCount = new Set(results.map((r) => r.order_code)).size;
    const qtySold = results.reduce((s, r) => s + r.quantity, 0);

    body = (
      <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard icon={ClipboardList} label="Số đơn" value={String(orderCount)} color="blue" />
          <KpiCard icon={ShoppingCart} label="SL bán" value={String(qtySold)} color="stone" />
          <KpiCard icon={DollarSign} label="Doanh thu" value={formatVnd(revenue)} color="emerald" />
          <KpiCard icon={TrendingUp} label="Lãi gộp" value={formatVnd(revenue - cost)} color="amber" />
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <th className="p-3">Đơn</th>
                    <th className="p-3">Khách hàng</th>
                    <th className="p-3">SKU</th>
                    <th className="p-3">SL</th>
                    <th className="p-3">Đơn giá</th>
                    <th className="p-3">Thành tiền</th>
                    <th className="p-3">Lãi gộp</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-b border-stone-100">
                      <td className="p-3 font-medium">{r.order_code}</td>
                      <td className="p-3">{r.customer_name}</td>
                      <td className="p-3 font-mono text-xs">{r.sku}</td>
                      <td className="p-3">{r.quantity}</td>
                      <td className="p-3">{formatVnd(r.unit_price)}</td>
                      <td className="p-3 font-medium">{formatVnd(r.line_total)}</td>
                      <td className="p-3 text-emerald-700">{formatVnd(r.line_total - r.cost_total)}</td>
                    </tr>
                  ))}
                  {results.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-stone-500">
                        Không có dữ liệu trong khoảng thời gian này
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </>
    );
  } else if (tab === "revenue") {
    interface Row {
      month: string;
      order_count: number;
      revenue: number;
      cost: number;
    }
    const { results } = await db
      .prepare(
        `SELECT strftime('%Y-%m', o.created_at) as month, COUNT(DISTINCT o.id) as order_count,
                SUM(o.total_amount) as revenue, COALESCE(SUM(oi.quantity * pv.cost_price), 0) as cost
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         LEFT JOIN product_variants pv ON pv.id = oi.product_variant_id
         WHERE o.status != 'CANCELLED' AND substr(o.created_at,1,10) BETWEEN ? AND ?
         GROUP BY month ORDER BY month ASC`
      )
      .bind(from, to)
      .all<Row>();

    const totalRevenue = results.reduce((s, r) => s + r.revenue, 0);
    const totalCost = results.reduce((s, r) => s + r.cost, 0);

    body = (
      <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <KpiCard icon={DollarSign} label="Tổng doanh thu" value={formatVnd(totalRevenue)} color="emerald" />
          <KpiCard icon={TrendingUp} label="Tổng lãi gộp" value={formatVnd(totalRevenue - totalCost)} color="amber" />
          <KpiCard
            icon={Percent}
            label="Biên lợi nhuận gộp"
            value={totalRevenue > 0 ? `${(((totalRevenue - totalCost) / totalRevenue) * 100).toFixed(1)}%` : "—"}
            color="blue"
          />
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <th className="p-3">Tháng</th>
                    <th className="p-3">Số đơn</th>
                    <th className="p-3">Doanh thu</th>
                    <th className="p-3">Lãi gộp</th>
                    <th className="p-3">Biên LN</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.month} className="border-b border-stone-100">
                      <td className="p-3 font-medium">{r.month}</td>
                      <td className="p-3">{r.order_count}</td>
                      <td className="p-3">{formatVnd(r.revenue)}</td>
                      <td className="p-3 text-emerald-700">{formatVnd(r.revenue - r.cost)}</td>
                      <td className="p-3">{r.revenue > 0 ? `${(((r.revenue - r.cost) / r.revenue) * 100).toFixed(1)}%` : "—"}</td>
                    </tr>
                  ))}
                  {results.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-stone-500">
                        Không có dữ liệu
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </>
    );
  } else if (tab === "purchasing") {
    interface Row {
      po_code: string;
      created_at: string;
      supplier_name: string;
      sku: string;
      product_name: string;
      quantity: number;
      unit_cost: number;
      line_total: number;
    }
    const { results } = await db
      .prepare(
        `SELECT po.po_code, po.created_at, s.name as supplier_name, poi.sku, poi.product_name, poi.quantity, poi.unit_cost, poi.line_total
         FROM purchase_order_items poi
         JOIN purchase_orders po ON po.id = poi.purchase_order_id
         JOIN suppliers s ON s.id = po.supplier_id
         WHERE po.status = 'CONFIRMED' AND substr(po.created_at,1,10) BETWEEN ? AND ?
         ORDER BY po.created_at DESC LIMIT 500`
      )
      .bind(from, to)
      .all<Row>();

    const totalAmount = results.reduce((s, r) => s + r.line_total, 0);
    const qty = results.reduce((s, r) => s + r.quantity, 0);
    const poCount = new Set(results.map((r) => r.po_code)).size;

    body = (
      <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <KpiCard icon={ClipboardList} label="Số đơn mua" value={String(poCount)} color="blue" />
          <KpiCard icon={ShoppingCart} label="SL mua" value={String(qty)} color="stone" />
          <KpiCard icon={DollarSign} label="Tổng tiền mua" value={formatVnd(totalAmount)} color="red" />
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <th className="p-3">Đơn mua</th>
                    <th className="p-3">Nhà cung cấp</th>
                    <th className="p-3">SKU</th>
                    <th className="p-3">SL</th>
                    <th className="p-3">Đơn giá</th>
                    <th className="p-3">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-b border-stone-100">
                      <td className="p-3 font-medium">{r.po_code}</td>
                      <td className="p-3">{r.supplier_name}</td>
                      <td className="p-3 font-mono text-xs">{r.sku}</td>
                      <td className="p-3">{r.quantity}</td>
                      <td className="p-3">{formatVnd(r.unit_cost)}</td>
                      <td className="p-3 font-medium">{formatVnd(r.line_total)}</td>
                    </tr>
                  ))}
                  {results.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-stone-500">
                        Không có dữ liệu trong khoảng thời gian này
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </>
    );
  } else if (tab === "stock") {
    interface Row {
      sku: string;
      product_name: string;
      nhap: number;
      xuat: number;
      ton_hien_tai: number;
    }
    const { results } = await db
      .prepare(
        `SELECT pv.sku, p.name as product_name,
                COALESCE(SUM(CASE WHEN t.quantity > 0 AND substr(t.created_at,1,10) BETWEEN ? AND ? THEN t.quantity ELSE 0 END), 0) as nhap,
                COALESCE(SUM(CASE WHEN t.quantity < 0 AND substr(t.created_at,1,10) BETWEEN ? AND ? THEN -t.quantity ELSE 0 END), 0) as xuat,
                inv.quantity_on_hand as ton_hien_tai
         FROM product_variants pv
         JOIN products p ON p.id = pv.product_id
         JOIN inventory inv ON inv.product_variant_id = pv.id
         LEFT JOIN inventory_transactions t ON t.product_variant_id = pv.id
         WHERE pv.is_active = 1
         GROUP BY pv.id
         ORDER BY p.name ASC`
      )
      .bind(from, to, from, to)
      .all<Row>();

    body = (
      <>
        <p className="text-xs text-stone-400">
          Nhập/Xuất tính trong khoảng thời gian đã chọn. Tồn hiện tại là số dư kho tại thời điểm xem báo cáo (không
          phải tồn cuối kỳ nếu bạn chọn khoảng thời gian trong quá khứ). Xem chi tiết từng giao dịch tại{" "}
          <Link href="/inventory/transactions" className="underline">
            Lịch sử giao dịch kho
          </Link>
          .
        </p>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <th className="p-3">SKU</th>
                    <th className="p-3">Sản phẩm</th>
                    <th className="p-3">Nhập trong kỳ</th>
                    <th className="p-3">Xuất trong kỳ</th>
                    <th className="p-3">Tồn hiện tại</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.sku} className="border-b border-stone-100">
                      <td className="p-3 font-mono text-xs">{r.sku}</td>
                      <td className="p-3">{r.product_name}</td>
                      <td className="p-3 text-emerald-700">{r.nhap}</td>
                      <td className="p-3 text-red-600">{r.xuat}</td>
                      <td className="p-3 font-medium">{r.ton_hien_tai}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </>
    );
  } else if (tab === "cash") {
    interface Row {
      direction: "IN" | "OUT";
      category: string;
      expense_group: string | null;
      total: number;
      cnt: number;
    }
    const { results } = await db
      .prepare(
        `SELECT direction, category, expense_group, SUM(amount) as total, COUNT(*) as cnt
         FROM cash_vouchers
         WHERE substr(voucher_date,1,10) BETWEEN ? AND ?
         GROUP BY direction, category, expense_group
         ORDER BY direction ASC, total DESC`
      )
      .bind(from, to)
      .all<Row>();

    const totalIn = results.filter((r) => r.direction === "IN").reduce((s, r) => s + r.total, 0);
    const totalOut = results.filter((r) => r.direction === "OUT").reduce((s, r) => s + r.total, 0);

    body = (
      <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <KpiCard icon={HandCoins} label="Tổng thu" value={formatVnd(totalIn)} color="emerald" />
          <KpiCard icon={HandCoins} label="Tổng chi" value={formatVnd(totalOut)} color="red" />
          <KpiCard icon={DollarSign} label="Chênh lệch" value={formatVnd(totalIn - totalOut)} color="amber" />
        </div>
        <p className="text-xs text-stone-400">
          Xem đầy đủ từng phiếu và số dư quỹ chạy liên tục tại{" "}
          <Link href="/cash" className="underline">
            Thu / Chi &amp; Sổ quỹ
          </Link>
          .
        </p>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <th className="p-3">Loại</th>
                    <th className="p-3">Nhóm</th>
                    <th className="p-3">Số phiếu</th>
                    <th className="p-3">Tổng tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-b border-stone-100">
                      <td className="p-3">{r.direction === "IN" ? "Thu" : "Chi"}</td>
                      <td className="p-3">{r.expense_group ?? (r.category === "SALE_ORDER" ? "Thu bán hàng" : r.category === "PURCHASE_ORDER" ? "Trả nợ NCC" : "Khác")}</td>
                      <td className="p-3">{r.cnt}</td>
                      <td className={`p-3 font-medium ${r.direction === "IN" ? "text-emerald-700" : "text-red-600"}`}>
                        {formatVnd(r.total)}
                      </td>
                    </tr>
                  ))}
                  {results.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-stone-500">
                        Không có dữ liệu
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </>
    );
  } else if (tab === "profit") {
    interface Row {
      sku: string;
      product_name: string;
      qty: number;
      revenue: number;
      cost: number;
    }
    const { results } = await db
      .prepare(
        `SELECT oi.sku, oi.product_name, SUM(oi.quantity) as qty, SUM(oi.line_total) as revenue,
                SUM(oi.quantity * pv.cost_price) as cost
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         JOIN product_variants pv ON pv.id = oi.product_variant_id
         WHERE o.status != 'CANCELLED' AND substr(o.created_at,1,10) BETWEEN ? AND ?
         GROUP BY oi.product_variant_id
         ORDER BY revenue DESC`
      )
      .bind(from, to)
      .all<Row>();

    const expenseRow = await db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as t FROM cash_vouchers
         WHERE direction = 'OUT' AND category = 'OTHER' AND substr(voucher_date,1,10) BETWEEN ? AND ?`
      )
      .bind(from, to)
      .first<{ t: number }>();

    const revenue = results.reduce((s, r) => s + r.revenue, 0);
    const cost = results.reduce((s, r) => s + r.cost, 0);
    const grossProfit = revenue - cost;
    const operatingExpense = expenseRow?.t ?? 0;
    const netProfit = grossProfit - operatingExpense;

    body = (
      <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard icon={DollarSign} label="Doanh thu" value={formatVnd(revenue)} color="blue" />
          <KpiCard icon={TrendingUp} label="Lãi gộp" value={formatVnd(grossProfit)} color="emerald" />
          <KpiCard icon={HandCoins} label="Chi phí hoạt động" value={formatVnd(operatingExpense)} color="red" />
          <KpiCard icon={Percent} label="Lợi nhuận ròng" value={formatVnd(netProfit)} color="amber" />
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <th className="p-3">SKU</th>
                    <th className="p-3">Sản phẩm</th>
                    <th className="p-3">SL bán</th>
                    <th className="p-3">Doanh thu</th>
                    <th className="p-3">Lãi gộp</th>
                    <th className="p-3">Biên LN</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.sku} className="border-b border-stone-100">
                      <td className="p-3 font-mono text-xs">{r.sku}</td>
                      <td className="p-3">{r.product_name}</td>
                      <td className="p-3">{r.qty}</td>
                      <td className="p-3">{formatVnd(r.revenue)}</td>
                      <td className="p-3 text-emerald-700">{formatVnd(r.revenue - r.cost)}</td>
                      <td className="p-3">{r.revenue > 0 ? `${(((r.revenue - r.cost) / r.revenue) * 100).toFixed(1)}%` : "—"}</td>
                    </tr>
                  ))}
                  {results.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-stone-500">
                        Không có dữ liệu
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </>
    );
  } else if (tab === "monthly") {
    interface RevRow {
      month: string;
      revenue: number;
      cost: number;
    }
    interface ExpRow {
      month: string;
      expense: number;
    }
    const [revResult, expResult] = await Promise.all([
      db
        .prepare(
          `SELECT strftime('%Y-%m', o.created_at) as month, SUM(o.total_amount) as revenue,
                  COALESCE(SUM(oi.quantity * pv.cost_price), 0) as cost
           FROM orders o
           LEFT JOIN order_items oi ON oi.order_id = o.id
           LEFT JOIN product_variants pv ON pv.id = oi.product_variant_id
           WHERE o.status != 'CANCELLED' AND substr(o.created_at,1,10) BETWEEN ? AND ?
           GROUP BY month`
        )
        .bind(from, to)
        .all<RevRow>(),
      db
        .prepare(
          `SELECT strftime('%Y-%m', voucher_date) as month, SUM(amount) as expense
           FROM cash_vouchers
           WHERE direction = 'OUT' AND category = 'OTHER' AND substr(voucher_date,1,10) BETWEEN ? AND ?
           GROUP BY month`
        )
        .bind(from, to)
        .all<ExpRow>(),
    ]);

    const months = new Set([...revResult.results.map((r) => r.month), ...expResult.results.map((r) => r.month)]);
    const rows = [...months]
      .sort()
      .map((month) => {
        const rev = revResult.results.find((r) => r.month === month);
        const exp = expResult.results.find((r) => r.month === month);
        const revenue = rev?.revenue ?? 0;
        const cost = rev?.cost ?? 0;
        const expense = exp?.expense ?? 0;
        return { month, revenue, cost, expense, grossProfit: revenue - cost, netProfit: revenue - cost - expense };
      });

    body = (
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                  <th className="p-3">Tháng</th>
                  <th className="p-3">Doanh thu</th>
                  <th className="p-3">Giá vốn</th>
                  <th className="p-3">Lãi gộp</th>
                  <th className="p-3">Chi phí hoạt động</th>
                  <th className="p-3">Lợi nhuận ròng</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.month} className="border-b border-stone-100">
                    <td className="p-3 font-medium">{r.month}</td>
                    <td className="p-3">{formatVnd(r.revenue)}</td>
                    <td className="p-3 text-stone-500">{formatVnd(r.cost)}</td>
                    <td className="p-3 text-emerald-700">{formatVnd(r.grossProfit)}</td>
                    <td className="p-3 text-red-600">{formatVnd(r.expense)}</td>
                    <td className={`p-3 font-bold ${r.netProfit >= 0 ? "text-amber-800" : "text-red-600"}`}>
                      {formatVnd(r.netProfit)}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-stone-500">
                      Không có dữ liệu
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  } else {
    // analysis: so sánh kỳ này với kỳ liền trước có cùng độ dài
    const fromD = new Date(from);
    const toD = new Date(to);
    const spanMs = toD.getTime() - fromD.getTime();
    const prevTo = new Date(fromD.getTime() - 24 * 60 * 60 * 1000);
    const prevFrom = new Date(prevTo.getTime() - spanMs);
    const prevFromStr = isoDate(prevFrom);
    const prevToStr = isoDate(prevTo);

    interface PeriodStats {
      revenue: number;
      cost: number;
      order_count: number;
    }

    async function loadStats(f: string, t: string): Promise<PeriodStats> {
      const row = await db
        .prepare(
          `SELECT COALESCE(SUM(o.total_amount), 0) as revenue, COUNT(DISTINCT o.id) as order_count,
                  COALESCE((SELECT SUM(oi.quantity * pv.cost_price) FROM order_items oi
                            JOIN product_variants pv ON pv.id = oi.product_variant_id
                            JOIN orders o2 ON o2.id = oi.order_id
                            WHERE o2.status != 'CANCELLED' AND substr(o2.created_at,1,10) BETWEEN ? AND ?), 0) as cost
           FROM orders o
           WHERE o.status != 'CANCELLED' AND substr(o.created_at,1,10) BETWEEN ? AND ?`
        )
        .bind(f, t, f, t)
        .first<PeriodStats>();
      return row ?? { revenue: 0, cost: 0, order_count: 0 };
    }

    const [current, previous, expenseCur] = await Promise.all([
      loadStats(from, to),
      loadStats(prevFromStr, prevToStr),
      db
        .prepare(
          `SELECT COALESCE(SUM(amount), 0) as t FROM cash_vouchers
           WHERE direction = 'OUT' AND category = 'OTHER' AND substr(voucher_date,1,10) BETWEEN ? AND ?`
        )
        .bind(from, to)
        .first<{ t: number }>(),
    ]);

    function pctChange(cur: number, prev: number): string {
      if (prev === 0) return cur === 0 ? "0%" : "+∞%";
      const pct = ((cur - prev) / Math.abs(prev)) * 100;
      return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
    }

    const grossProfitCur = current.revenue - current.cost;
    const grossProfitPrev = previous.revenue - previous.cost;
    const netProfitCur = grossProfitCur - (expenseCur?.t ?? 0);
    const avgOrderCur = current.order_count > 0 ? current.revenue / current.order_count : 0;
    const marginCur = current.revenue > 0 ? (grossProfitCur / current.revenue) * 100 : 0;

    interface StatLine {
      label: string;
      current: string;
      previous: string;
      change: string;
    }
    const lines: StatLine[] = [
      {
        label: "Doanh thu trước thuế",
        current: formatVnd(current.revenue),
        previous: formatVnd(previous.revenue),
        change: pctChange(current.revenue, previous.revenue),
      },
      {
        label: "Lãi gộp",
        current: formatVnd(grossProfitCur),
        previous: formatVnd(grossProfitPrev),
        change: pctChange(grossProfitCur, grossProfitPrev),
      },
      {
        label: "Chi phí hoạt động",
        current: formatVnd(expenseCur?.t ?? 0),
        previous: "—",
        change: "—",
      },
      {
        label: "Lợi nhuận ròng",
        current: formatVnd(netProfitCur),
        previous: "—",
        change: "—",
      },
      {
        label: "Số đơn bán",
        current: String(current.order_count),
        previous: String(previous.order_count),
        change: pctChange(current.order_count, previous.order_count),
      },
      {
        label: "Giá trị đơn TB",
        current: formatVnd(avgOrderCur),
        previous: previous.order_count > 0 ? formatVnd(previous.revenue / previous.order_count) : "—",
        change:
          previous.order_count > 0 ? pctChange(avgOrderCur, previous.revenue / previous.order_count) : "—",
      },
    ];

    body = (
      <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard icon={DollarSign} label="Doanh thu" value={formatVnd(current.revenue)} color="blue" />
          <KpiCard icon={TrendingUp} label="Lãi gộp" value={formatVnd(grossProfitCur)} color="emerald" />
          <KpiCard icon={Percent} label="Biên lợi nhuận gộp" value={`${marginCur.toFixed(1)}%`} color="amber" />
          <KpiCard icon={HandCoins} label="Lợi nhuận ròng" value={formatVnd(netProfitCur)} color="red" />
        </div>
        <p className="text-xs text-stone-400">
          Kỳ trước để so sánh: {prevFromStr} → {prevToStr} (cùng độ dài với kỳ đang chọn).
        </p>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <th className="p-3">Chỉ số</th>
                    <th className="p-3">Kỳ hiện tại</th>
                    <th className="p-3">Kỳ trước</th>
                    <th className="p-3">% thay đổi</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.label} className="border-b border-stone-100">
                      <td className="p-3 text-stone-500">{l.label}</td>
                      <td className="p-3 font-medium">{l.current}</td>
                      <td className="p-3 text-stone-500">{l.previous}</td>
                      <td
                        className={`p-3 font-medium ${
                          l.change.startsWith("+") ? "text-emerald-700" : l.change.startsWith("-") ? "text-red-600" : "text-stone-400"
                        }`}
                      >
                        {l.change}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-stone-900">Báo cáo chuyên sâu</h1>
      {filterBar}
      {tabsNav}
      {body}
    </div>
  );
}
