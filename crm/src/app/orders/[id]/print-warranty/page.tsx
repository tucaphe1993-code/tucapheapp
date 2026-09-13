import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { COMPANY_INFO } from "@/lib/constants";
import { PrintButton } from "@/components/print-button";
import { formatDate } from "@/lib/utils";
import type { CustomerRow, DeviceRow, OrderItemRow, OrderRow } from "@/types/db";

interface WarrantyItemJoined extends OrderItemRow {
  model: string | null;
  warranty_months: number;
}

function addMonths(iso: string, months: number): Date {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  d.setMonth(d.getMonth() + months);
  return d;
}

export default async function OrderWarrantyPrintPage({ params }: PageProps<"/orders/[id]/print-warranty">) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/my-tasks");

  const { id } = await params;
  const db = getDb();

  const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first<OrderRow>();
  if (!order) notFound();

  const [customer, { results: items }] = await Promise.all([
    db.prepare(`SELECT * FROM customers WHERE id = ?`).bind(order.customer_id).first<CustomerRow>(),
    db
      .prepare(
        `SELECT oi.*, pv.model, pv.warranty_months FROM order_items oi
         JOIN product_variants pv ON pv.id = oi.product_variant_id
         WHERE oi.order_id = ? AND pv.warranty_months IS NOT NULL`
      )
      .bind(id)
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

  return (
    <div className="min-h-screen bg-stone-100 py-6 print:bg-white print:py-0">
      <style>{`
        @page { size: A5 portrait; margin: 10mm; }
        @media print {
          tr { break-inside: avoid; }
        }
      `}</style>

      <div className="mx-auto flex max-w-[148mm] justify-end px-4 pb-3 print:hidden">
        <PrintButton />
      </div>

      <div className="mx-auto max-w-[148mm] bg-white p-6 text-[12px] leading-relaxed text-stone-900 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <div className="flex items-center gap-3 border-b-2 pb-3" style={{ borderColor: "#085D18" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-tucaphe.png" alt="Tú Cà Phê" className="h-16 w-16 shrink-0" />
          <div>
            <div className="text-base font-bold" style={{ color: "#085D18" }}>
              {COMPANY_INFO.brandName}
            </div>
            <div className="text-xs italic text-amber-800">{COMPANY_INFO.slogan}</div>
            <div className="mt-1 text-[11px] text-stone-600">Địa chỉ: {COMPANY_INFO.address}</div>
            <div className="text-[11px] text-stone-600">Hotline: {COMPANY_INFO.phone}</div>
          </div>
        </div>

        <h1 className="mt-3 mb-3 text-center text-lg font-bold uppercase tracking-wide" style={{ color: "#085D18" }}>
          Phiếu bảo hành
        </h1>

        <div className="mb-3 flex justify-between text-[11px]">
          <div>
            <span className="text-stone-500">Mã đơn: </span>
            <span className="font-semibold">{order.order_code}</span>
          </div>
          <div>
            <span className="text-stone-500">Ngày mua: </span>
            <span className="font-semibold">{formatDate(order.created_at)}</span>
          </div>
        </div>

        <div className="mb-3 rounded-md bg-amber-50 p-2.5">
          <div className="mb-1 text-[11px] font-bold uppercase text-amber-900">Thông tin khách hàng</div>
          <div>
            <span className="text-stone-500">Khách hàng: </span>
            <span className="font-medium">{customer?.name ?? "Khách lẻ"}</span>
          </div>
          {order.customer_phone_snapshot && (
            <div>
              <span className="text-stone-500">Số điện thoại: </span>
              {order.customer_phone_snapshot}
            </div>
          )}
          {order.customer_address_snapshot && (
            <div>
              <span className="text-stone-500">Địa chỉ: </span>
              {order.customer_address_snapshot}
            </div>
          )}
        </div>

        <table className="mb-3 w-full border-collapse text-[11px]">
          <thead>
            <tr style={{ backgroundColor: "#e7f2e9" }}>
              <th className="border border-stone-300 p-1.5 text-center" style={{ color: "#085D18" }}>
                STT
              </th>
              <th className="border border-stone-300 p-1.5 text-left" style={{ color: "#085D18" }}>
                Thiết bị
              </th>
              <th className="border border-stone-300 p-1.5 text-left" style={{ color: "#085D18" }}>
                Serial
              </th>
              <th className="border border-stone-300 p-1.5 text-center" style={{ color: "#085D18" }}>
                Bảo hành
              </th>
              <th className="border border-stone-300 p-1.5 text-right" style={{ color: "#085D18" }}>
                Đến ngày
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const device = item.device_id ? devices.get(item.device_id) : undefined;
              const activated = !!device?.warranty_end_date;
              const endDate = activated
                ? new Date(device!.warranty_end_date!.replace(" ", "T") + "Z")
                : addMonths(order.created_at, item.warranty_months);
              return (
                <tr key={item.id}>
                  <td className="border border-stone-300 p-1.5 text-center">{idx + 1}</td>
                  <td className="border border-stone-300 p-1.5">
                    {item.product_name}
                    {item.model ? <div className="text-[10px] text-stone-500">{item.model}</div> : null}
                  </td>
                  <td className="border border-stone-300 p-1.5 font-mono">
                    {device?.serial_number ?? "—"}
                  </td>
                  <td className="border border-stone-300 p-1.5 text-center">{item.warranty_months} tháng</td>
                  <td className="border border-stone-300 p-1.5 text-right">
                    {formatDate(endDate.toISOString())}
                    {!activated && <div className="text-[9px] text-stone-400">(dự kiến)</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mb-3 text-[11px] text-stone-500">
          Vui lòng giữ phiếu này để được hỗ trợ bảo hành khi cần.
        </div>

        <div className="mt-8 grid grid-cols-2 gap-6 text-center text-[11px]">
          <div>
            <div className="font-bold uppercase" style={{ color: "#085D18" }}>
              Đại diện {COMPANY_INFO.brandName}
            </div>
            <div className="mt-10 border-t border-stone-400 pt-1 text-stone-500">Ký và ghi rõ họ tên</div>
          </div>
          <div>
            <div className="font-bold uppercase" style={{ color: "#085D18" }}>
              Khách hàng
            </div>
            <div className="mt-10 border-t border-stone-400 pt-1 text-stone-500">Ký và ghi rõ họ tên</div>
          </div>
        </div>

        <div className="mt-6 border-t border-dashed border-stone-300 pt-3 text-center text-[11px]">
          <div className="font-bold" style={{ color: "#085D18" }}>
            {COMPANY_INFO.brandName}
          </div>
          <div className="italic text-stone-500">{COMPANY_INFO.slogan}</div>
          <div className="mt-1 text-stone-500">
            Hotline: {COMPANY_INFO.phone} · Địa chỉ: {COMPANY_INFO.address}
          </div>
        </div>
      </div>
    </div>
  );
}
