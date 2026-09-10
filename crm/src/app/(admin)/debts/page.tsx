import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DebtStatusBadge } from "@/components/orders/debt-status-badge";
import { computeDebtStatus, DEBT_STATUS_LABEL } from "@/lib/services/debts";
import { formatDate, formatVnd } from "@/lib/utils";
import { DollarSign, HandCoins, PiggyBank, AlertTriangle } from "lucide-react";
import type { DebtStatus, OrderStatus } from "@/types/db";

interface DebtOrderRow {
  id: string;
  order_code: string;
  customer_id: string;
  customer_name: string;
  total_amount: number;
  payment_due_date: string | null;
  status: OrderStatus;
  created_at: string;
  paid_amount: number;
}

export default async function DebtsPage({ searchParams }: PageProps<"/debts">) {
  const { status } = await searchParams;
  const db = getDb();

  const { results: orders } = await db
    .prepare(
      `SELECT o.id, o.order_code, o.customer_id, c.name as customer_name, o.total_amount,
              o.payment_due_date, o.status, o.created_at,
              COALESCE((SELECT SUM(amount) FROM payments WHERE order_id = o.id), 0) as paid_amount
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       WHERE o.status != 'CANCELLED'
       ORDER BY o.created_at DESC`
    )
    .all<DebtOrderRow>();

  const rows = orders.map((o) => ({
    ...o,
    remaining: Math.max(0, o.total_amount - o.paid_amount),
    debtStatus: computeDebtStatus({
      totalAmount: o.total_amount,
      paidAmount: o.paid_amount,
      dueDate: o.payment_due_date,
    }),
  }));

  const totalReceivable = rows.reduce((sum, r) => sum + r.total_amount, 0);
  const totalPaid = rows.reduce((sum, r) => sum + r.paid_amount, 0);
  const totalRemaining = totalReceivable - totalPaid;
  const totalOverdue = rows.filter((r) => r.debtStatus === "OVERDUE").reduce((sum, r) => sum + r.remaining, 0);

  const tabs: { label: string; value: DebtStatus | "" }[] = [
    { label: "Tất cả", value: "" },
    { label: DEBT_STATUS_LABEL.UNPAID, value: "UNPAID" },
    { label: DEBT_STATUS_LABEL.PARTIAL, value: "PARTIAL" },
    { label: DEBT_STATUS_LABEL.OVERDUE, value: "OVERDUE" },
    { label: DEBT_STATUS_LABEL.PAID, value: "PAID" },
  ];
  const activeTab = (status as DebtStatus | undefined) ?? "";
  const filteredRows = activeTab ? rows.filter((r) => r.debtStatus === activeTab) : rows;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-stone-900">Công nợ</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={DollarSign} label="Tổng phải thu" value={formatVnd(totalReceivable)} color="blue" />
        <KpiCard icon={HandCoins} label="Đã thu" value={formatVnd(totalPaid)} color="emerald" />
        <KpiCard icon={PiggyBank} label="Còn phải thu" value={formatVnd(totalRemaining)} color="amber" />
        <KpiCard icon={AlertTriangle} label="Công nợ quá hạn" value={formatVnd(totalOverdue)} color="purple" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={t.value ? `/debts?status=${t.value}` : "/debts"}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              activeTab === t.value ? "bg-amber-800 text-white" : "bg-white text-stone-600 border border-stone-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {filteredRows.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-stone-500">Không có công nợ</CardContent>
          </Card>
        )}
        {filteredRows.map((r) => (
          <Link key={r.id} href={`/orders/${r.id}`}>
            <Card className="hover:border-amber-300">
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">{r.customer_name}</div>
                  <div className="text-sm text-stone-500">
                    {formatDate(r.created_at)}
                    {r.payment_due_date ? ` · Hạn: ${formatDate(r.payment_due_date)}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-medium">{formatVnd(r.remaining)}</div>
                    <div className="text-xs text-stone-400">/ {formatVnd(r.total_amount)}</div>
                  </div>
                  <DebtStatusBadge status={r.debtStatus} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
