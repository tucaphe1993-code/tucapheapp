import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceStatusBadge } from "@/components/devices/device-status-badge";
import { EditDeviceDialog } from "@/components/devices/edit-device-dialog";
import { formatDate, formatDateTime, formatVnd } from "@/lib/utils";
import type {
  CustomerRow,
  DeviceHistoryRow,
  DeviceRow,
  OrderRow,
  ProductRow,
  ProductVariantRow,
  UserRow,
} from "@/types/db";

const EVENT_LABEL: Record<string, string> = {
  RECEIVE: "Nhập kho",
  SELL: "Bán hàng",
  RELEASE: "Hủy đơn — trả về kho",
  STATUS_CHANGE: "Đổi trạng thái",
  UPDATE: "Cập nhật thông tin",
};

export default async function DeviceDetailPage({ params }: PageProps<"/devices/[id]">) {
  const { id } = await params;
  const db = getDb();

  const device = await db.prepare(`SELECT * FROM devices WHERE id = ?`).bind(id).first<DeviceRow>();
  if (!device) notFound();

  const [product, variant, customer, order, { results: history }] = await Promise.all([
    db.prepare(`SELECT * FROM products WHERE id = ?`).bind(device.product_id).first<ProductRow>(),
    db.prepare(`SELECT * FROM product_variants WHERE id = ?`).bind(device.product_variant_id).first<ProductVariantRow>(),
    device.customer_id
      ? db.prepare(`SELECT * FROM customers WHERE id = ?`).bind(device.customer_id).first<CustomerRow>()
      : Promise.resolve(null),
    device.order_id
      ? db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(device.order_id).first<OrderRow>()
      : Promise.resolve(null),
    db
      // created_at has 1-second resolution — order by rowid too so a fast
      // sequence of events within the same second still sorts correctly.
      .prepare(`SELECT * FROM device_history WHERE device_id = ? ORDER BY created_at DESC, rowid DESC`)
      .bind(id)
      .all<DeviceHistoryRow>(),
  ]);

  const actorIds = [...new Set(history.map((h) => h.created_by).filter((v): v is string => !!v))];
  const actorNames = new Map<string, string>();
  if (actorIds.length > 0) {
    const placeholders = actorIds.map(() => "?").join(",");
    const { results } = await db
      .prepare(`SELECT id, full_name FROM users WHERE id IN (${placeholders})`)
      .bind(...actorIds)
      .all<Pick<UserRow, "id" | "full_name">>();
    results.forEach((r) => actorNames.set(r.id, r.full_name));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-stone-900 font-mono">{device.serial_number}</h1>
            <DeviceStatusBadge status={device.status} />
          </div>
          <div className="text-sm text-stone-500">
            {product?.name} {variant?.model ? `· ${variant.model}` : ""}
          </div>
        </div>
        <EditDeviceDialog device={device} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lịch sử thiết bị</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {history.length === 0 && <div className="text-sm text-stone-500">Chưa có lịch sử</div>}
              {history.map((h) => (
                <div key={h.id} className="border-b border-stone-100 pb-2 text-sm last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{EVENT_LABEL[h.event_type] ?? h.event_type}</span>
                    <span className="text-xs text-stone-400">{formatDateTime(h.created_at)}</span>
                  </div>
                  {h.note && <div className="text-stone-500">{h.note}</div>}
                  {h.created_by && (
                    <div className="text-xs text-stone-400">Người thực hiện: {actorNames.get(h.created_by) ?? "—"}</div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thông tin thiết bị</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 text-sm">
              <div>
                <span className="text-stone-500">SKU: </span>
                {variant?.sku}
              </div>
              <div>
                <span className="text-stone-500">Giá vốn: </span>
                {formatVnd(device.cost_price ?? 0)}
              </div>
              <div>
                <span className="text-stone-500">Nhà cung cấp: </span>
                {device.supplier || "—"}
              </div>
              <div>
                <span className="text-stone-500">Ngày nhập: </span>
                {formatDate(device.received_at)}
              </div>
              {customer && (
                <div>
                  <span className="text-stone-500">Khách hàng: </span>
                  <Link href={`/customers/${customer.id}`} className="text-amber-800 hover:underline">
                    {customer.name}
                  </Link>
                </div>
              )}
              {order && (
                <div>
                  <span className="text-stone-500">Đơn hàng: </span>
                  <Link href={`/orders/${order.id}`} className="text-amber-800 hover:underline">
                    {order.order_code}
                  </Link>
                </div>
              )}
              {device.sold_at && (
                <div>
                  <span className="text-stone-500">Ngày bán: </span>
                  {formatDate(device.sold_at)}
                </div>
              )}
              {device.handed_over_at && (
                <div>
                  <span className="text-stone-500">Ngày bàn giao: </span>
                  {formatDate(device.handed_over_at)}
                </div>
              )}
              {device.warranty_start_date && (
                <div>
                  <span className="text-stone-500">Bắt đầu bảo hành: </span>
                  {formatDate(device.warranty_start_date)}
                </div>
              )}
              {device.warranty_end_date && (
                <div>
                  <span className="text-stone-500">Hết bảo hành: </span>
                  {formatDate(device.warranty_end_date)}
                </div>
              )}
              {device.note && (
                <div>
                  <span className="text-stone-500">Ghi chú: </span>
                  {device.note}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
