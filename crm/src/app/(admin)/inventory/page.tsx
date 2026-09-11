import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReceiveInventoryDialog, AdjustInventoryDialog } from "@/components/inventory/inventory-actions-dialog";
import { ReceiveDeviceDialog } from "@/components/inventory/receive-device-dialog";
import { DEVICE_STATUS_LABEL } from "@/lib/services/devices";
import type { DeviceStatus, InventoryRow } from "@/types/db";

interface InventoryJoined extends InventoryRow {
  product_name: string;
  form: string | null;
  packaging: string | null;
  weight_grams: number | null;
}

interface DeviceStockRow {
  product_id: string;
  product_variant_id: string;
  product_name: string;
  sku: string;
  status: DeviceStatus;
  c: number;
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
        <CardContent className="p-0">
          <div className="overflow-x-auto">
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
                        {r.form && (
                          <div className="text-xs text-stone-400">
                            {FORM_LABEL[r.form]} · {PACKAGING_LABEL[r.packaging!]} ·{" "}
                            {r.weight_grams! >= 1000 ? `${r.weight_grams! / 1000}kg` : `${r.weight_grams}g`}
                          </div>
                        )}
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
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-stone-500">
                      Chưa có hàng hóa nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
