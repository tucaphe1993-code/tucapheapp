import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InventoryNav } from "@/components/inventory/inventory-nav";
import { RoastBatchFormDialog } from "@/components/inventory/roast-batch-form-dialog";
import { getRoastCostConfig } from "@/lib/services/roasting";
import { formatDate, formatKg, formatVnd } from "@/lib/utils";
import type { RoastBatchRow } from "@/types/db";

interface VariantRow {
  id: string;
  sku: string;
  product_name: string;
  quantity_on_hand: number;
  cost_price: number;
}

export default async function RoastingPage() {
  const db = getDb();

  const [greenVariants, roastedVariants, batches, config] = await Promise.all([
    db
      .prepare(
        `SELECT pv.id, pv.sku, p.name as product_name, inv.quantity_on_hand, pv.cost_price
         FROM product_variants pv
         JOIN products p ON p.id = pv.product_id
         JOIN inventory inv ON inv.product_variant_id = pv.id
         WHERE p.product_type = 'COFFEE' AND p.coffee_stage = 'GREEN' AND pv.is_active = 1
         ORDER BY p.name ASC`
      )
      .all<VariantRow>(),
    db
      .prepare(
        `SELECT pv.id, pv.sku, p.name as product_name, inv.quantity_on_hand, pv.cost_price
         FROM product_variants pv
         JOIN products p ON p.id = pv.product_id
         JOIN inventory inv ON inv.product_variant_id = pv.id
         WHERE p.product_type = 'COFFEE' AND p.coffee_stage = 'ROASTED' AND pv.is_active = 1
         ORDER BY p.name ASC`
      )
      .all<VariantRow>(),
    db.prepare(`SELECT * FROM roast_batches ORDER BY created_at DESC LIMIT 100`).all<RoastBatchRow>(),
    getRoastCostConfig(db),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">Rang / Sản xuất</h1>
        <div className="flex items-center gap-2">
          <Link href="/inventory/roasting/config" className="text-sm font-medium text-amber-800 hover:underline">
            Cấu hình chi phí rang
          </Link>
          <RoastBatchFormDialog
            greenVariants={greenVariants.results.map((v) => ({
              id: v.id,
              sku: v.sku,
              productName: v.product_name,
              quantityOnHand: v.quantity_on_hand,
              costPrice: v.cost_price,
            }))}
            roastedVariants={roastedVariants.results.map((v) => ({
              id: v.id,
              sku: v.sku,
              productName: v.product_name,
            }))}
            defaultShrinkagePercent={config.default_shrinkage_percent}
            needsLaborHours={config.labor_cost_mode === "PER_HOUR" || config.labor_cost_mode === "PER_DAY"}
          />
        </div>
      </div>

      <InventoryNav active="/inventory/roasting" />

      {(greenVariants.results.length === 0 || roastedVariants.results.length === 0) && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-900">
            Chưa có đủ SKU nhân xanh và cà phê rang rời để tạo mẻ rang. Vào{" "}
            <Link href="/products" className="underline">
              Sản phẩm
            </Link>{" "}
            tạo dòng sản phẩm loại &quot;Cà phê&quot; với công đoạn &quot;Nhân xanh&quot; / &quot;Rang rời&quot; trước.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                  <th className="p-3">Mã mẻ</th>
                  <th className="p-3">Ngày tạo</th>
                  <th className="p-3">Nhân xanh vào</th>
                  <th className="p-3">Thành phẩm</th>
                  <th className="p-3">Hao hụt</th>
                  <th className="p-3">Giá vốn/kg</th>
                  <th className="p-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {batches.results.map((b) => (
                  <tr key={b.id} className="border-b border-stone-100">
                    <td className="p-3">
                      <Link href={`/inventory/roasting/${b.id}`} className="font-medium text-amber-800 hover:underline">
                        {b.batch_code}
                      </Link>
                    </td>
                    <td className="p-3 text-stone-500">{formatDate(b.created_at)}</td>
                    <td className="p-3">{formatKg(b.input_kg)}</td>
                    <td className="p-3">{formatKg(b.finished_kg)}</td>
                    <td className="p-3 text-stone-500">
                      {formatKg(b.shrinkage_kg)} ({b.shrinkage_percent}%)
                    </td>
                    <td className="p-3">{formatVnd(b.cost_per_kg)}</td>
                    <td className="p-3">
                      <Badge variant={b.status === "CONFIRMED" ? "success" : "secondary"}>
                        {b.status === "CONFIRMED" ? "Đã xác nhận" : "Nháp"}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {batches.results.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-stone-500">
                      Chưa có mẻ rang nào
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
