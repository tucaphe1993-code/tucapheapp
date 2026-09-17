import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CashVoucherFormDialog } from "@/components/cash/cash-voucher-form-dialog";
import { formatDateTime, formatVnd } from "@/lib/utils";

interface VoucherRow {
  id: string;
  voucher_code: string;
  direction: "IN" | "OUT";
  voucher_date: string;
  category: string;
  expense_group: string | null;
  payment_method_code: string | null;
  amount: number;
  description: string | null;
  note: string | null;
  is_auto: number;
  customer_name: string | null;
  supplier_name: string | null;
  created_by_name: string | null;
  running_balance: number;
}

const CATEGORY_LABEL: Record<string, string> = {
  SALE_ORDER: "Thu bán hàng",
  PURCHASE_ORDER: "Trả nợ NCC",
  OTHER: "Khác",
};

export default async function CashPage({ searchParams }: PageProps<"/cash">) {
  const { tab } = await searchParams;
  const activeTab = (Array.isArray(tab) ? tab[0] : tab) || "ledger";
  const db = getDb();

  const direction = activeTab === "receipts" ? "IN" : activeTab === "payments" ? "OUT" : null;

  const baseSelect = `SELECT v.id, v.voucher_code, v.direction, v.voucher_date, v.category, v.expense_group,
              v.payment_method_code, v.amount, v.description, v.note, v.is_auto,
              c.name as customer_name, s.name as supplier_name, u.full_name as created_by_name,
              SUM(CASE WHEN v.direction = 'IN' THEN v.amount ELSE -v.amount END)
                OVER (ORDER BY v.voucher_date ASC, v.created_at ASC, v.id ASC) as running_balance
       FROM cash_vouchers v
       LEFT JOIN customers c ON c.id = v.customer_id
       LEFT JOIN suppliers s ON s.id = v.supplier_id
       LEFT JOIN users u ON u.id = v.created_by`;

  const stmt = direction
    ? db.prepare(`${baseSelect} WHERE v.direction = ? ORDER BY v.voucher_date DESC, v.created_at DESC LIMIT 300`).bind(direction)
    : db.prepare(`${baseSelect} ORDER BY v.voucher_date DESC, v.created_at DESC LIMIT 300`);
  const { results } = await stmt.all<VoucherRow>();

  const totalIn = await db.prepare(`SELECT COALESCE(SUM(amount), 0) as t FROM cash_vouchers WHERE direction = 'IN'`).first<{ t: number }>();
  const totalOut = await db.prepare(`SELECT COALESCE(SUM(amount), 0) as t FROM cash_vouchers WHERE direction = 'OUT'`).first<{ t: number }>();
  const balance = (totalIn?.t ?? 0) - (totalOut?.t ?? 0);

  const tabs = [
    { label: "Sổ quỹ", value: "ledger" },
    { label: "Phiếu thu", value: "receipts" },
    { label: "Phiếu chi", value: "payments" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-stone-900">Thu / Chi & Sổ quỹ</h1>
        <div className="flex gap-2">
          <CashVoucherFormDialog direction="IN" />
          <CashVoucherFormDialog direction="OUT" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3">
            <div className="text-xs text-stone-500">Tổng thu</div>
            <div className="text-lg font-bold text-emerald-700">{formatVnd(totalIn?.t ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="text-xs text-stone-500">Tổng chi</div>
            <div className="text-lg font-bold text-red-600">{formatVnd(totalOut?.t ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="text-xs text-stone-500">Số dư quỹ</div>
            <div className="text-lg font-bold text-amber-800">{formatVnd(balance)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={`/cash?tab=${t.value}`}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              activeTab === t.value ? "bg-amber-800 text-white" : "bg-white text-stone-600 border border-stone-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                  <th className="p-3">Số phiếu</th>
                  <th className="p-3">Ngày</th>
                  <th className="p-3">Loại</th>
                  <th className="p-3">Đối tượng</th>
                  <th className="p-3">Diễn giải</th>
                  <th className="p-3">Thu</th>
                  <th className="p-3">Chi</th>
                  {activeTab === "ledger" && <th className="p-3">Số dư</th>}
                </tr>
              </thead>
              <tbody>
                {results.map((v) => (
                  <tr key={v.id} className="border-b border-stone-100">
                    <td className="p-3 font-medium">{v.voucher_code}</td>
                    <td className="p-3 whitespace-nowrap text-stone-500">{formatDateTime(v.voucher_date)}</td>
                    <td className="p-3">
                      <Badge variant={v.is_auto ? "secondary" : "info"}>
                        {v.expense_group ?? CATEGORY_LABEL[v.category] ?? v.category}
                      </Badge>
                    </td>
                    <td className="p-3">{v.customer_name ?? v.supplier_name ?? "—"}</td>
                    <td className="p-3 text-stone-500">
                      {v.description ?? "—"}
                      {v.note && <div className="text-xs text-stone-400">{v.note}</div>}
                    </td>
                    <td className="p-3 font-medium text-emerald-700">{v.direction === "IN" ? formatVnd(v.amount) : "—"}</td>
                    <td className="p-3 font-medium text-red-600">{v.direction === "OUT" ? formatVnd(v.amount) : "—"}</td>
                    {activeTab === "ledger" && <td className="p-3 font-semibold">{formatVnd(v.running_balance)}</td>}
                  </tr>
                ))}
                {results.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-stone-500">
                      Chưa có phiếu thu/chi nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
