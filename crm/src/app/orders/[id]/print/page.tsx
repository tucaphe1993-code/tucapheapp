import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { COMPANY_INFO, PAYMENT_METHODS } from "@/lib/constants";
import { PrintButton } from "@/components/print-button";
import { formatDate, formatVnd } from "@/lib/utils";
import type { CustomerRow, DeviceRow, OrderItemRow, OrderRow, PaymentRow, UserRow } from "@/types/db";

const FORM_LABEL: Record<string, string> = { HAT: "Hạt", BOT: "Bột" };
const PACKAGING_LABEL: Record<string, string> = { TUI_XANH: "Túi Xanh", TUI_ZIP: "Túi Zip" };

interface OrderItemJoined extends OrderItemRow {
  unit: string;
}

export default async function OrderReceiptPrintPage({ params }: PageProps<"/orders/[id]/print">) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/my-tasks");

  const { id } = await params;
  const db = getDb();

  const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first<OrderRow>();
  if (!order) notFound();

  const [customer, { results: items }, { results: payments }, employee] = await Promise.all([
    db.prepare(`SELECT * FROM customers WHERE id = ?`).bind(order.customer_id).first<CustomerRow>(),
    db
      .prepare(
        `SELECT oi.*, pv.unit FROM order_items oi
         JOIN product_variants pv ON pv.id = oi.product_variant_id
         WHERE oi.order_id = ?`
      )
      .bind(id)
      .all<OrderItemJoined>(),
    db.prepare(`SELECT * FROM payments WHERE order_id = ? ORDER BY paid_at ASC`).bind(id).all<PaymentRow>(),
    db.prepare(`SELECT * FROM users WHERE id = ?`).bind(order.created_by).first<UserRow>(),
  ]);

  const deviceIds = items.map((i) => i.device_id).filter((v): v is string => !!v);
  const deviceSerials = new Map<string, string>();
  if (deviceIds.length > 0) {
    const placeholders = deviceIds.map(() => "?").join(",");
    const { results } = await db
      .prepare(`SELECT id, serial_number FROM devices WHERE id IN (${placeholders})`)
      .bind(...deviceIds)
      .all<Pick<DeviceRow, "id" | "serial_number">>();
    results.forEach((r) => deviceSerials.set(r.id, r.serial_number));
  }

  const subtotal = items.reduce((sum, i) => sum + i.line_total, 0);
  const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, order.total_amount - paidAmount);

  const paymentStatus =
    remaining <= 0 ? "ĐÃ THANH TOÁN" : paidAmount > 0 ? "THANH TOÁN MỘT PHẦN" : "CHƯA THANH TOÁN";

  // "Công nợ" không phải 1 phương thức thanh toán được ghi nhận (payments.method)
  // mà là suy ra từ việc đơn còn nợ — đánh dấu cùng lúc với (các) phương thức
  // thực tế đã dùng để thu tiền, nếu có.
  const usedMethods = new Set(payments.map((p) => p.method).filter((m): m is string => !!m));
  const methodChecked = (label: string) => usedMethods.has(label) || (label === "Công nợ" && remaining > 0);

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
        {/* Header */}
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
          Phiếu bán hàng
        </h1>

        {/* Order info */}
        <div className="mb-3 flex justify-between text-[11px]">
          <div>
            <div>
              <span className="text-stone-500">Mã đơn: </span>
              <span className="font-semibold">{order.order_code}</span>
            </div>
            <div>
              <span className="text-stone-500">Nhân viên: </span>
              <span className="font-semibold">{employee?.full_name ?? "—"}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-stone-500">Ngày bán: </span>
            <span className="font-semibold">{formatDate(order.created_at)}</span>
          </div>
        </div>

        {/* Customer info */}
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

        {/* Products table */}
        <table className="mb-3 w-full border-collapse text-[11px]">
          <thead>
            <tr style={{ backgroundColor: "#e7f2e9" }}>
              <th className="border border-stone-300 p-1.5 text-center" style={{ color: "#085D18" }}>
                STT
              </th>
              <th className="border border-stone-300 p-1.5 text-left" style={{ color: "#085D18" }}>
                Sản phẩm
              </th>
              <th className="border border-stone-300 p-1.5" style={{ color: "#085D18" }}>
                ĐVT
              </th>
              <th className="border border-stone-300 p-1.5" style={{ color: "#085D18" }}>
                SL
              </th>
              <th className="border border-stone-300 p-1.5 text-right" style={{ color: "#085D18" }}>
                Đơn giá
              </th>
              <th className="border border-stone-300 p-1.5 text-right" style={{ color: "#085D18" }}>
                Thành tiền
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id}>
                <td className="border border-stone-300 p-1.5 text-center">{idx + 1}</td>
                <td className="border border-stone-300 p-1.5">
                  {item.product_name}
                  {item.device_id ? (
                    <div className="text-[10px] text-stone-500">
                      Serial: {deviceSerials.get(item.device_id) ?? "—"}
                    </div>
                  ) : item.form ? (
                    <div className="text-[10px] text-stone-500">
                      {FORM_LABEL[item.form]} - {PACKAGING_LABEL[item.packaging!]} -{" "}
                      {item.weight_grams! >= 1000 ? `${item.weight_grams! / 1000}kg` : `${item.weight_grams}g`}
                    </div>
                  ) : null}
                </td>
                <td className="border border-stone-300 p-1.5 text-center">{item.unit}</td>
                <td className="border border-stone-300 p-1.5 text-center">{item.quantity}</td>
                <td className="border border-stone-300 p-1.5 text-right">{formatVnd(item.unit_price)}</td>
                <td className="border border-stone-300 p-1.5 text-right font-medium">
                  {formatVnd(item.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Payment summary */}
        <div className="mb-3 flex flex-col gap-1 border-t border-dashed border-stone-300 pt-2 text-[11px]">
          <div className="flex justify-between">
            <span className="text-stone-500">Tạm tính</span>
            <span>{formatVnd(subtotal)}</span>
          </div>
          <div className="flex justify-between border-t border-stone-300 pt-1 text-sm font-bold">
            <span>TỔNG THANH TOÁN</span>
            <span>{formatVnd(order.total_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Đã thanh toán</span>
            <span className="text-emerald-700">{formatVnd(paidAmount)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span>CÒN LẠI</span>
            <span className={remaining > 0 ? "text-red-600" : ""}>{formatVnd(remaining)}</span>
          </div>
        </div>

        {/* Payment status */}
        <div className="mb-3 text-center">
          <span
            className="inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase"
            style={
              remaining <= 0
                ? { backgroundColor: "#e7f2e9", color: "#085D18" }
                : paidAmount > 0
                  ? { backgroundColor: "#fef3c7", color: "#92400e" }
                  : { backgroundColor: "#fee2e2", color: "#b91c1c" }
            }
          >
            {paymentStatus}
          </span>
        </div>

        {/* Payment method */}
        <div className="mb-3">
          <div className="mb-1 text-[11px] font-bold uppercase" style={{ color: "#085D18" }}>
            Phương thức thanh toán
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
            {[...PAYMENT_METHODS, "Công nợ"].map((label) => (
              <span key={label}>
                {methodChecked(label) ? "☑" : "☐"} {label}
              </span>
            ))}
          </div>
        </div>

        {order.note && (
          <div className="mb-3 text-[11px]">
            <div className="font-bold uppercase" style={{ color: "#085D18" }}>
              Ghi chú
            </div>
            <div className="text-stone-600">{order.note}</div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 border-t border-dashed border-stone-300 pt-3 text-center text-[11px]">
          <div className="font-medium text-amber-800">Cảm ơn quý khách đã tin tưởng và ủng hộ!</div>
          <div className="mt-2 font-bold" style={{ color: "#085D18" }}>
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
