import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { InventoryNav } from "@/components/inventory/inventory-nav";
import { SellForm } from "@/components/inventory/sell-form";
import { getRoastCostConfig } from "@/lib/services/roasting";

interface FinishedVariantRow {
  id: string;
  sku: string;
  product_name: string;
  unit_price: number;
  source_green_variant_id: string | null;
  green_sku: string | null;
  green_quantity_on_hand: number | null;
}

export default async function InventorySellPage() {
  const db = getDb();

  const [finishedVariants, config] = await Promise.all([
    db
      .prepare(
        `SELECT pv.id, pv.sku, p.name as product_name, pv.unit_price, pv.source_green_variant_id,
                gpv.sku as green_sku, ginv.quantity_on_hand as green_quantity_on_hand
         FROM product_variants pv
         JOIN products p ON p.id = pv.product_id
         LEFT JOIN product_variants gpv ON gpv.id = pv.source_green_variant_id
         LEFT JOIN inventory ginv ON ginv.product_variant_id = pv.source_green_variant_id
         WHERE p.product_type = 'COFFEE' AND p.coffee_stage = 'ROASTED' AND pv.is_active = 1
         ORDER BY p.name ASC`
      )
      .all<FinishedVariantRow>(),
    getRoastCostConfig(db),
  ]);

  const ratio = 1 - config.default_shrinkage_percent / 100;
  const unconfigured = finishedVariants.results.filter((v) => !v.source_green_variant_id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">Bán hàng — Cà phê thành phẩm</h1>
        <Link href="/inventory/config" className="text-sm font-medium text-amber-800 hover:underline">
          Cấu hình tỷ lệ chuyển đổi
        </Link>
      </div>

      <InventoryNav active="/inventory/sell" />

      {finishedVariants.results.length === 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-900">
            Chưa có SKU cà phê thành phẩm nào. Vào{" "}
            <Link href="/products" className="underline">
              Sản phẩm
            </Link>{" "}
            tạo dòng sản phẩm loại &quot;Cà phê&quot; với công đoạn &quot;Rang rời&quot; trước.
          </CardContent>
        </Card>
      )}

      {unconfigured.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-900">
            ⚠️ SKU chưa cấu hình nguyên liệu nhân xanh nguồn (không thể bán): {unconfigured.map((v) => v.sku).join(", ")}
          </CardContent>
        </Card>
      )}

      <Card className="max-w-xl">
        <CardContent className="pt-4">
          <SellForm
            finishedVariants={finishedVariants.results
              .filter((v) => v.source_green_variant_id)
              .map((v) => ({
                id: v.id,
                sku: v.sku,
                productName: v.product_name,
                unitPrice: v.unit_price,
                greenSku: v.green_sku!,
                greenQuantityOnHand: v.green_quantity_on_hand ?? 0,
              }))}
            ratio={ratio}
            shrinkagePercent={config.default_shrinkage_percent}
          />
        </CardContent>
      </Card>

      <p className="text-xs text-stone-400">
        Công thức: KG nhân xanh tiêu hao = KG thành phẩm bán / {ratio.toFixed(3)}. Xem chi tiết từng lần bán tại{" "}
        <Link href="/inventory/transactions?type=SALE" className="underline">
          Lịch sử giao dịch
        </Link>
        .
      </p>
    </div>
  );
}
