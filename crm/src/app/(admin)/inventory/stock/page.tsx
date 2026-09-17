import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InventoryNav } from "@/components/inventory/inventory-nav";
import { InventoryStockTable, type StockRow } from "@/components/inventory/inventory-stock-table";
import { ReceiveDeviceDialog } from "@/components/inventory/receive-device-dialog";
import { DEVICE_STATUS_LABEL } from "@/lib/services/devices";
import { isBulkWeightProduct } from "@/lib/constants";
import type { DeviceStatus, InventoryRow } from "@/types/db";

interface InventoryJoined extends InventoryRow {
  product_name: string;
  product_type: string;
  coffee_stage: string | null;
  unit: string | null;
  cost_price: number;
  nhap_mua: number;
  nhap_khac: number;
  xuat_ban: number;
  xuat_khac: number;
}

interface DeviceStockRow {
  product_id: string;
  product_variant_id: string;
  product_name: string;
  sku: string;
  status: DeviceStatus;
  c: number;
}

export default async function InventoryStockPage() {
  const db = getDb();
  // Nhập mua = nhập từ đơn mua NCC; Nhập khác = nhập tay/điều chỉnh tăng.
  // Xuất bán = xuất cho đơn hàng (ISSUE) + bán cà phê rang rời (SALE);
  // Xuất khác = điều chỉnh giảm. Tất cả tính TỪ inventory_transactions,
  // không lưu cột riêng — luôn khớp với lịch sử giao dịch thực tế.
  const { results: rows } = await db
    .prepare(
      `WITH tx_agg AS (
         SELECT
           product_variant_id,
           SUM(CASE WHEN type = 'RECEIVE' AND reference_type = 'PURCHASE_ORDER' THEN quantity ELSE 0 END) as nhap_mua,
           SUM(CASE WHEN type = 'RECEIVE' AND reference_type != 'PURCHASE_ORDER' THEN quantity ELSE 0 END)
             + SUM(CASE WHEN type = 'ADJUSTMENT' AND quantity > 0 THEN quantity ELSE 0 END) as nhap_khac,
           SUM(CASE WHEN type IN ('ISSUE', 'SALE') THEN -quantity ELSE 0 END) as xuat_ban,
           SUM(CASE WHEN type = 'ADJUSTMENT' AND quantity < 0 THEN -quantity ELSE 0 END) as xuat_khac
         FROM inventory_transactions
         GROUP BY product_variant_id
       )
       SELECT inv.*, p.name as product_name, p.product_type, p.coffee_stage, pv.unit, pv.cost_price,
              COALESCE(tx.nhap_mua, 0) as nhap_mua, COALESCE(tx.nhap_khac, 0) as nhap_khac,
              COALESCE(tx.xuat_ban, 0) as xuat_ban, COALESCE(tx.xuat_khac, 0) as xuat_khac
       FROM inventory inv
       JOIN product_variants pv ON pv.id = inv.product_variant_id
       JOIN products p ON p.id = pv.product_id
       LEFT JOIN tx_agg tx ON tx.product_variant_id = pv.id
       ORDER BY p.name ASC, pv.weight_grams ASC`
    )
    .all<InventoryJoined>();

  const { results: deviceStock } = await db
    .prepare(
      `SELECT d.product_id, d.product_variant_id, p.name as product_name, pv.sku, d.status, COUNT(*) as c
       FROM devices d
       JOIN products p ON p.id = d.product_id
       JOIN product_variants pv ON pv.id = d.product_variant_id
       GROUP BY d.product_variant_id, d.status
       ORDER BY p.name ASC`
    )
    .all<DeviceStockRow>();

  const totalUnits = rows.reduce((s, r) => s + r.quantity_on_hand, 0);
  const lowStock = rows.filter((r) => r.quantity_on_hand <= r.low_stock_threshold);

  const stockRows: StockRow[] = rows.map((r) => ({
    productVariantId: r.product_variant_id,
    sku: r.sku,
    productName: r.product_name,
    unit: r.unit,
    lowStockThreshold: r.low_stock_threshold,
    nhapMua: r.nhap_mua,
    nhapKhac: r.nhap_khac,
    xuatBan: r.xuat_ban,
    xuatKhac: r.xuat_khac,
    quantityOnHand: r.quantity_on_hand,
    costPrice: r.cost_price,
    bulkWeight: isBulkWeightProduct(r.product_type, r.coffee_stage),
    isRoastedFinished: r.coffee_stage === "ROASTED",
  }));

  const deviceVariants = new Map<
    string,
    { productId: string; productName: string; sku: string; counts: { status: DeviceStatus; c: number }[] }
  >();
  for (const d of deviceStock) {
    const entry = deviceVariants.get(d.product_variant_id) ?? {
      productId: d.product_id,
      productName: d.product_name,
      sku: d.sku,
      counts: [],
    };
    entry.counts.push({ status: d.status, c: d.c });
    deviceVariants.set(d.product_variant_id, entry);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">Kho</h1>
        <div className="text-sm text-stone-500">Tổng tồn hàng hóa: {totalUnits.toLocaleString("vi-VN")} đơn vị</div>
      </div>

      <InventoryNav active="/inventory/stock" />

      {lowStock.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-900">
            ⚠️ {lowStock.length} SKU sắp hết hàng: {lowStock.map((r) => r.sku).join(", ")}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hàng hóa / Tiêu hao</CardTitle>
        </CardHeader>
        <CardContent>
          <InventoryStockTable rows={stockRows} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Máy / Thiết bị (theo Serial)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {deviceVariants.size === 0 && (
            <div className="py-4 text-center text-sm text-stone-500">Chưa có máy/thiết bị nào</div>
          )}
          {[...deviceVariants.entries()].map(([variantId, v]) => {
            const total = v.counts.reduce((s, c) => s + c.c, 0);
            return (
              <div key={variantId} className="rounded-lg border border-stone-200 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {v.productName} <span className="text-stone-400 font-normal">({v.sku})</span>
                    </div>
                    <Link href={`/devices?variantId=${variantId}`} className="text-xs text-amber-800 hover:underline">
                      Tổng {total} máy
                    </Link>
                  </div>
                  <ReceiveDeviceDialog productId={v.productId} variantId={variantId} sku={v.sku} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-stone-100 pt-2 text-xs text-stone-500">
                  {v.counts.map((c) => (
                    <span key={c.status}>
                      {DEVICE_STATUS_LABEL[c.status]}: <span className="font-medium text-stone-700">{c.c}</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
