import { getDb } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InventoryNav } from "@/components/inventory/inventory-nav";
import { getRoastCostConfig } from "@/lib/services/roasting";
import { formatVnd, formatKg } from "@/lib/utils";

interface StockValueRow {
  total_value: number;
  total_sku: number;
}

interface CoffeeStageRow {
  coffee_stage: string;
  total_kg: number;
}

export default async function InventoryOverviewPage() {
  const db = getDb();

  const [stockValue, coffeeStageRows, deviceCounts, lowStockCount, config] = await Promise.all([
    db
      .prepare(
        `SELECT COALESCE(SUM(inv.quantity_on_hand * pv.cost_price), 0) as total_value, COUNT(*) as total_sku
         FROM inventory inv JOIN product_variants pv ON pv.id = inv.product_variant_id
         WHERE pv.is_active = 1`
      )
      .first<StockValueRow>(),
    db
      .prepare(
        `SELECT p.coffee_stage as coffee_stage, COALESCE(SUM(inv.quantity_on_hand), 0) as total_kg
         FROM inventory inv
         JOIN product_variants pv ON pv.id = inv.product_variant_id
         JOIN products p ON p.id = pv.product_id
         WHERE p.product_type = 'COFFEE' AND p.coffee_stage IS NOT NULL
         GROUP BY p.coffee_stage`
      )
      .all<CoffeeStageRow>(),
    db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM devices) as total_devices,
           (SELECT COUNT(*) FROM devices WHERE status = 'IN_STOCK') as in_stock_devices`
      )
      .first<{ total_devices: number; in_stock_devices: number }>(),
    db
      .prepare(`SELECT COUNT(*) as c FROM inventory WHERE quantity_on_hand <= low_stock_threshold`)
      .first<{ c: number }>(),
    getRoastCostConfig(db),
  ]);

  const greenKg = coffeeStageRows.results.find((r) => r.coffee_stage === "GREEN")?.total_kg ?? 0;
  // KHÔNG còn tồn kho thành phẩm riêng — "sản lượng khả dụng" là số kg
  // thành phẩm CÓ THỂ bán nếu quy đổi hết tồn nhân xanh hiện có, tính
  // TỨC THỜI từ tồn nhân xanh (không lưu trạng thái trung gian nào).
  const sellableCapacity = greenKg * (1 - config.default_shrinkage_percent / 100);

  // Cảnh báo riêng cho từng SKU nhân xanh — KHÔNG trộn với cà phê rang.
  const { results: greenLowStock } = await db
    .prepare(
      `SELECT pv.sku, inv.quantity_on_hand, inv.low_stock_threshold
       FROM inventory inv
       JOIN product_variants pv ON pv.id = inv.product_variant_id
       JOIN products p ON p.id = pv.product_id
       WHERE p.product_type = 'COFFEE' AND p.coffee_stage = 'GREEN'
         AND inv.quantity_on_hand <= inv.low_stock_threshold`
    )
    .all<{ sku: string; quantity_on_hand: number; low_stock_threshold: number }>();

  const cards = [
    { label: "Tổng giá trị tồn kho", value: formatVnd(stockValue?.total_value ?? 0) },
    { label: "Tổng số SKU", value: String(stockValue?.total_sku ?? 0) },
    { label: "Tồn cà phê nhân xanh", value: formatKg(greenKg) },
    { label: "Tổng số máy/thiết bị", value: String(deviceCounts?.total_devices ?? 0) },
    { label: "Máy đang tồn (IN STOCK)", value: String(deviceCounts?.in_stock_devices ?? 0) },
    { label: "SKU sắp hết hàng", value: String(lowStockCount?.c ?? 0) },
    {
      label: `Sản lượng thành phẩm có thể bán (hao hụt ${config.default_shrinkage_percent}%)`,
      value: formatKg(sellableCapacity),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">Kho — Tổng quan</h1>
      </div>

      <InventoryNav active="/inventory" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="py-4">
              <div className="text-xs text-stone-500">{c.label}</div>
              <div className="mt-1 text-lg font-bold text-stone-900">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {greenLowStock.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base text-amber-900">⚠️ Cảnh báo tồn cà phê nhân xanh</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-amber-900">
            {greenLowStock.map((r) => (
              <div key={r.sku} className="flex items-center justify-between">
                <span>{r.sku}</span>
                <span>
                  Còn {formatKg(r.quantity_on_hand)} (ngưỡng {formatKg(r.low_stock_threshold)})
                  {r.quantity_on_hand < 0 ? null : r.quantity_on_hand === 0 ? (
                    <Badge variant="danger" className="ml-2">
                      Hết hàng
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="ml-2">
                      Sắp hết
                    </Badge>
                  )}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
