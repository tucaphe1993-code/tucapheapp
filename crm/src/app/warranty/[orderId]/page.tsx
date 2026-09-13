import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { COMPANY_INFO } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { addWarrantyMonths } from "@/lib/warranty";
import type { CustomerRow, DeviceRow, OrderItemRow, OrderRow } from "@/types/db";

const GREEN = "#085D18";
const GREEN_LIGHT = "#E9F4EA";

interface WarrantyItemJoined extends OrderItemRow {
  model: string | null;
  warranty_months: number;
}

// Trang công khai (không cần đăng nhập) để khách quét QR trên phiếu bảo
// hành tra cứu tình trạng bảo hành — chỉ lộ thông tin cần thiết cho việc
// tra cứu (tên khách, thiết bị, serial, hạn bảo hành), KHÔNG lộ SĐT/địa
// chỉ/giá trị đơn hàng.
export default async function WarrantyLookupPage({ params }: PageProps<"/warranty/[orderId]">) {
  const { orderId } = await params;
  const db = getDb();

  const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first<OrderRow>();
  if (!order) notFound();

  const [customer, { results: items }] = await Promise.all([
    db.prepare(`SELECT * FROM customers WHERE id = ?`).bind(order.customer_id).first<CustomerRow>(),
    db
      .prepare(
        `SELECT oi.*, pv.model, pv.warranty_months FROM order_items oi
         JOIN product_variants pv ON pv.id = oi.product_variant_id
         WHERE oi.order_id = ? AND pv.warranty_months IS NOT NULL`
      )
      .bind(orderId)
      .all<WarrantyItemJoined>(),
  ]);

  if (items.length === 0) notFound();

  const deviceIds = items.map((i) => i.device_id).filter((v): v is string => !!v);
  const devices = new Map<string, DeviceRow>();
  if (deviceIds.length > 0) {
    const placeholders = deviceIds.map(() => "?").join(",");
    const { results } = await db
      .prepare(`SELECT * FROM devices WHERE id IN (${placeholders})`)
      .bind(...deviceIds)
      .all<DeviceRow>();
    results.forEach((d) => devices.set(d.id, d));
  }

  const now = new Date();

  return (
    <div className="min-h-screen bg-stone-100 px-4 py-8">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-tucaphe.png" alt="Tú Cà Phê" className="h-16 w-16" />
          <div className="mt-2 text-lg font-bold" style={{ color: GREEN }}>
            {COMPANY_INFO.brandName}
          </div>
          <div className="text-xs italic text-amber-800">{COMPANY_INFO.slogan}</div>
        </div>

        <h1
          className="mt-4 rounded-lg py-2 text-center text-base font-bold uppercase tracking-wide"
          style={{ backgroundColor: GREEN_LIGHT, color: GREEN }}
        >
          Tra cứu bảo hành
        </h1>

        <div className="mt-3 text-sm text-stone-600">
          <div>
            Mã đơn hàng: <span className="font-semibold text-stone-900">{order.order_code}</span>
          </div>
          <div>
            Khách hàng: <span className="font-semibold text-stone-900">{customer?.name ?? "—"}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {items.map((item) => {
            const device = item.device_id ? devices.get(item.device_id) : undefined;
            const activated = !!device?.warranty_end_date;
            const endDate = activated
              ? new Date(device!.warranty_end_date!.replace(" ", "T") + "Z")
              : addWarrantyMonths(order.created_at, item.warranty_months);
            const stillValid = endDate.getTime() >= now.getTime();

            return (
              <div key={item.id} className="rounded-xl border border-stone-200 p-3">
                <div className="font-semibold text-stone-900">
                  {item.product_name}
                  {item.model && <span className="font-normal text-stone-500"> — {item.model}</span>}
                </div>
                <div className="mt-1 text-sm text-stone-600">
                  Serial: <span className="font-mono">{device?.serial_number ?? "—"}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-stone-600">
                    {activated ? "Bảo hành đến" : "Dự kiến bảo hành đến"}: {formatDate(endDate.toISOString())}
                  </span>
                  <span
                    className="shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold uppercase"
                    style={
                      !activated
                        ? { backgroundColor: "#fef3c7", color: "#92400e" }
                        : stillValid
                          ? { backgroundColor: GREEN_LIGHT, color: GREEN }
                          : { backgroundColor: "#fee2e2", color: "#b91c1c" }
                    }
                  >
                    {!activated ? "Chưa kích hoạt" : stillValid ? "Còn bảo hành" : "Hết bảo hành"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 border-t border-dashed border-stone-300 pt-3 text-center text-xs text-stone-500">
          Cần hỗ trợ bảo hành? Gọi Hotline{" "}
          <span className="font-semibold" style={{ color: GREEN }}>
            {COMPANY_INFO.phone}
          </span>
          <div className="mt-0.5">{COMPANY_INFO.address}</div>
        </div>
      </div>
    </div>
  );
}
