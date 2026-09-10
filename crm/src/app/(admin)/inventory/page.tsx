import { getDb } from "@/lib/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReceiveInventoryDialog, AdjustInventoryDialog } from "@/components/inventory/inventory-actions-dialog";
import type { InventoryRow } from "@/types/db";

interface InventoryJoined extends InventoryRow {
  product_name: string;
  form: string;
  packaging: string;
  weight_grams: number;
}

const FORM_LABEL: Record<string, string> = { HAT: "Hạt", BOT: "Bột" };
const PACKAGING_LABEL: Record<string, string> = { TUI_XANH: "Túi Xanh", TUI_ZIP: "Túi Zip" };

export default async function InventoryPage() {
  const db = getDb();
  const { results: rows } = await db
    .prepare(
      `SELECT inv.*, p.name as product_name, pv.form, pv.packaging, pv.weight_grams
       FROM inventory inv
       JOIN product_variants pv ON pv.id = inv.product_variant_id
       JOIN products p ON p.id = pv.product_id
       ORDER BY p.name ASC, pv.weight_grams ASC`
    )
    .all<InventoryJoined>();

  const totalUnits = rows.reduce((s, r) => s + r.quantity_on_hand, 0);
  const lowStock = rows.filter((r) => r.quantity_on_hand <= r.low_stock_threshold);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">Kho</h1>
        <div className="text-sm text-stone-500">Tổng tồn: {totalUnits.toLocaleString("vi-VN")} đơn vị</div>
      </div>

      {lowStock.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-900">
            ⚠️ {lowStock.length} SKU sắp hết hàng: {lowStock.map((r) => r.sku).join(", ")}
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
              <th className="p-3">SKU</th>
              <th className="p-3">Sản phẩm</th>
              <th className="p-3">Tồn kho</th>
              <th className="p-3">Ngưỡng cảnh báo</th>
              <th className="p-3">Trạng thái</th>
              <th className="p-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const low = r.quantity_on_hand <= r.low_stock_threshold;
              return (
                <tr key={r.id} className="border-b border-stone-100">
                  <td className="p-3 font-mono text-xs">{r.sku}</td>
                  <td className="p-3">
                    {r.product_name}
                    <div className="text-xs text-stone-400">
                      {FORM_LABEL[r.form]} · {PACKAGING_LABEL[r.packaging]} ·{" "}
                      {r.weight_grams >= 1000 ? `${r.weight_grams / 1000}kg` : `${r.weight_grams}g`}
                    </div>
                  </td>
                  <td className="p-3 font-semibold">{r.quantity_on_hand}</td>
                  <td className="p-3 text-stone-500">{r.low_stock_threshold}</td>
                  <td className="p-3">
                    <Badge variant={low ? "warning" : "success"}>{low ? "Sắp hết" : "Đủ hàng"}</Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <ReceiveInventoryDialog productVariantId={r.product_variant_id} sku={r.sku} />
                      <AdjustInventoryDialog productVariantId={r.product_variant_id} sku={r.sku} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
