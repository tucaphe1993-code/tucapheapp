import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InventoryNav } from "@/components/inventory/inventory-nav";
import { isBulkWeightProduct } from "@/lib/constants";
import { formatDateTime, formatKg } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  RECEIVE: "Nhập kho",
  ISSUE: "Xuất kho (bán hàng)",
  ADJUSTMENT: "Điều chỉnh",
  ROAST_PRODUCTION: "Thành phẩm rang",
  ROAST_CONSUMPTION: "Tiêu thụ rang",
};

const TYPE_BADGE: Record<string, "success" | "danger" | "warning" | "info" | "secondary"> = {
  RECEIVE: "success",
  ISSUE: "danger",
  ADJUSTMENT: "warning",
  ROAST_PRODUCTION: "success",
  ROAST_CONSUMPTION: "danger",
};

interface TxRow {
  id: string;
  sku: string;
  product_name: string;
  quantity: number;
  type: string;
  note: string | null;
  created_at: string;
  created_by_name: string | null;
  product_type: string;
  coffee_stage: string | null;
}

export default async function InventoryTransactionsPage({
  searchParams,
}: PageProps<"/inventory/transactions">) {
  const { type } = await searchParams;
  const db = getDb();

  const stmt = type
    ? db.prepare(
        `SELECT t.id, t.sku, p.name as product_name, t.quantity, t.type, t.note, t.created_at,
                u.full_name as created_by_name, p.product_type, p.coffee_stage
         FROM inventory_transactions t
         JOIN product_variants pv ON pv.id = t.product_variant_id
         JOIN products p ON p.id = pv.product_id
         LEFT JOIN users u ON u.id = t.created_by
         WHERE t.type = ?
         ORDER BY t.created_at DESC LIMIT 200`
      ).bind(type)
    : db.prepare(
        `SELECT t.id, t.sku, p.name as product_name, t.quantity, t.type, t.note, t.created_at,
                u.full_name as created_by_name, p.product_type, p.coffee_stage
         FROM inventory_transactions t
         JOIN product_variants pv ON pv.id = t.product_variant_id
         JOIN products p ON p.id = pv.product_id
         LEFT JOIN users u ON u.id = t.created_by
         ORDER BY t.created_at DESC LIMIT 200`
      );
  const { results } = await stmt.all<TxRow>();

  const tabs = [
    { label: "Tất cả", value: "" },
    { label: "Nhập kho", value: "RECEIVE" },
    { label: "Xuất kho", value: "ISSUE" },
    { label: "Điều chỉnh", value: "ADJUSTMENT" },
    { label: "Rang", value: "ROAST_PRODUCTION" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-stone-900">Lịch sử giao dịch kho</h1>
      <InventoryNav active="/inventory/transactions" />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={t.value ? `/inventory/transactions?type=${t.value}` : "/inventory/transactions"}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              (type ?? "") === t.value
                ? "bg-stone-800 text-white"
                : "bg-white text-stone-600 border border-stone-200"
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
                  <th className="p-3">Thời gian</th>
                  <th className="p-3">Loại</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Sản phẩm</th>
                  <th className="p-3">Số lượng</th>
                  <th className="p-3">Ghi chú</th>
                  <th className="p-3">Người thực hiện</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const bulkWeight = isBulkWeightProduct(r.product_type, r.coffee_stage);
                  return (
                    <tr key={r.id} className="border-b border-stone-100">
                      <td className="p-3 whitespace-nowrap text-stone-500">{formatDateTime(r.created_at)}</td>
                      <td className="p-3">
                        <Badge variant={TYPE_BADGE[r.type] ?? "secondary"}>{TYPE_LABEL[r.type] ?? r.type}</Badge>
                      </td>
                      <td className="p-3 font-mono text-xs">{r.sku}</td>
                      <td className="p-3">{r.product_name}</td>
                      <td className={`p-3 font-medium ${r.quantity > 0 ? "text-emerald-700" : "text-red-600"}`}>
                        {r.quantity > 0 ? "+" : ""}
                        {bulkWeight ? formatKg(r.quantity) : r.quantity}
                      </td>
                      <td className="p-3 text-stone-500">{r.note ?? "—"}</td>
                      <td className="p-3 text-stone-500">{r.created_by_name ?? "—"}</td>
                    </tr>
                  );
                })}
                {results.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-stone-500">
                      Chưa có giao dịch nào
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
