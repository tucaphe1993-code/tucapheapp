import { getDb } from "@/lib/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { InventoryNav } from "@/components/inventory/inventory-nav";
import { StockCountForm } from "@/components/inventory/stock-count-form";
import { isBulkWeightProduct } from "@/lib/constants";

interface CountRow {
  product_variant_id: string;
  sku: string;
  product_name: string;
  quantity_on_hand: number;
  product_type: string;
  coffee_stage: string | null;
  unit: string | null;
}

export default async function StockCountPage() {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT inv.product_variant_id, inv.sku, p.name as product_name, inv.quantity_on_hand,
              p.product_type, p.coffee_stage, pv.unit
       FROM inventory inv
       JOIN product_variants pv ON pv.id = inv.product_variant_id
       JOIN products p ON p.id = pv.product_id
       ORDER BY p.name ASC`
    )
    .all<CountRow>();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-stone-900">Kiểm kê kho</h1>
      <InventoryNav active="/inventory/count" />

      <Card>
        <CardContent className="pt-4">
          <p className="mb-3 text-sm text-stone-500">
            Nhập tồn thực tế đếm được cho các SKU bị lệch — hệ thống tự tính chênh lệch và ghi nhận điều chỉnh (không
            sửa trực tiếp số tồn). SKU không nhập gì sẽ giữ nguyên tồn hiện tại.
          </p>
          <StockCountForm
            rows={results.map((r) => ({
              productVariantId: r.product_variant_id,
              sku: r.sku,
              productName: r.product_name,
              quantityOnHand: r.quantity_on_hand,
              allowDecimal: isBulkWeightProduct(r.product_type, r.coffee_stage),
              unit: r.unit ?? "",
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
