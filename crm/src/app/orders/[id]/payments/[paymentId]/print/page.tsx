import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { COMPANY_INFO } from "@/lib/constants";
import { PrintButton } from "@/components/print-button";
import { formatDate, formatVnd, numberToVietnameseWords } from "@/lib/utils";
import type { CustomerRow, OrderItemRow, OrderRow, PaymentRow, UserRow } from "@/types/db";

const GREEN = "#085D18";

// Phiếu thu tiền đặt cọc — đứng ngoài route group (admin), tự kiểm tra
// session/role giống hệt các trang in khác (orders/print, bao-gia/print).
export default async function DepositReceiptPrintPage({
  params,
}: PageProps<"/orders/[id]/payments/[paymentId]/print">) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/my-tasks");

  const { id, paymentId } = await params;
  const db = getDb();

  const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first<OrderRow>();
  if (!order) notFound();

  const payment = await db
    .prepare(`SELECT * FROM payments WHERE id = ? AND order_id = ?`)
    .bind(paymentId, id)
    .first<PaymentRow>();
  if (!payment) notFound();

  const [customer, { results: items }, { results: allPayments }, collector] = await Promise.all([
    db.prepare(`SELECT * FROM customers WHERE id = ?`).bind(order.customer_id).first<CustomerRow>(),
    db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).bind(id).all<OrderItemRow>(),
    db.prepare(`SELECT * FROM payments WHERE order_id = ?`).bind(id).all<PaymentRow>(),
    db.prepare(`SELECT * FROM users WHERE id = ?`).bind(payment.created_by).first<UserRow>(),
  ]);

  const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, order.total_amount - totalPaid);

  return (
    <div className="min-h-screen bg-stone-100 py-6 print:bg-white print:py-0">
      <style>{`
        @page { size: A5 portrait; margin: 10mm; }
        @media print { tr { break-inside: avoid; } }
      `}</style>

      <div className="mx-auto flex max-w-[148mm] justify-end px-4 pb-3 print:hidden">
        <PrintButton />
      </div>

      <div className="mx-auto max-w-[148mm] bg-white p-6 text-[12px] leading-relaxed text-stone-900 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        {/* Header */}
        <div className="flex items-center gap-3 border-b-2 pb-3" style={{ borderColor: GREEN }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-tucaphe.png" alt="Tú Cà Phê" className="h-16 w-16 shrink-0" />
          <div>
            <div className="text-base font-bold" style={{ color: GREEN }}>
              {COMPANY_INFO.brandName}
            </div>
            <div className="text-xs italic text-amber-800">{COMPANY_INFO.slogan}</div>
            <div className="mt-1 text-[11px] text-stone-600">Địa chỉ: {COMPANY_INFO.address}</div>
            <div className="text-[11px] text-stone-600">Hotline: {COMPANY_INFO.phone}</div>
          </div>
        </div>

        <h1 className="mt-3 mb-1 text-center text-lg font-bold uppercase tracking-wide" style={{ color: GREEN }}>
          Phiếu thu tiền đặt cọc
        </h1>
        <div className="mb-3 text-center text-[11px] text-stone-500">Ngày lập: {formatDate(payment.paid_at)}</div>

        {/* Order + customer info */}
        <div className="mb-3 rounded-md bg-amber-50 p-2.5">
          <div className="mb-1 text-[11px] font-bold uppercase text-amber-900">Người nộp tiền</div>
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
          <div className="mt-1">
            <span className="text-stone-500">Lý do nộp: </span>
            Đặt cọc mua hàng theo đơn <span className="font-semibold">{order.order_code}</span>
          </div>
          {payment.note && (
            <div>
              <span className="text-stone-500">Ghi chú: </span>
              {payment.note}
            </div>
          )}
        </div>

        {/* Products summary */}
        <table className="mb-3 w-full border-collapse text-[11px]">
          <thead>
            <tr style={{ backgroundColor: "#e7f2e9" }}>
              <th className="border border-stone-300 p-1.5 text-center" style={{ color: GREEN }}>
                STT
              </th>
              <th className="border border-stone-300 p-1.5 text-left" style={{ color: GREEN }}>
                Sản phẩm
              </th>
              <th className="border border-stone-300 p-1.5" style={{ color: GREEN }}>
                SL
              </th>
              <th className="border border-stone-300 p-1.5 text-right" style={{ color: GREEN }}>
                Thành tiền
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id}>
                <td className="border border-stone-300 p-1.5 text-center">{idx + 1}</td>
                <td className="border border-stone-300 p-1.5">{item.product_name}</td>
                <td className="border border-stone-300 p-1.5 text-center">{item.quantity}</td>
                <td className="border border-stone-300 p-1.5 text-right">{formatVnd(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Deposit amount — headline */}
        <div className="mb-3 rounded-md border-2 p-3" style={{ borderColor: GREEN }}>
          <div className="flex justify-between text-sm">
            <span className="font-semibold">Số tiền đặt cọc</span>
            <span className="text-lg font-bold" style={{ color: GREEN }}>
              {formatVnd(payment.amount)}
            </span>
          </div>
          <div className="mt-1 text-[11px] italic text-stone-600">
            Bằng chữ: {numberToVietnameseWords(payment.amount)}
          </div>
          {payment.method && (
            <div className="mt-1 text-[11px] text-stone-600">Hình thức: {payment.method}</div>
          )}
        </div>

        {/* Order total summary */}
        <div className="mb-4 flex flex-col gap-1 border-t border-dashed border-stone-300 pt-2 text-[11px]">
          <div className="flex justify-between">
            <span className="text-stone-500">Tổng tiền đơn hàng</span>
            <span>{formatVnd(order.total_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Tổng đã thu (kể cả lần này)</span>
            <span className="text-emerald-700">{formatVnd(totalPaid)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span>CÒN LẠI PHẢI THANH TOÁN</span>
            <span className={remaining > 0 ? "text-red-600" : ""}>{formatVnd(remaining)}</span>
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-6 grid grid-cols-2 gap-4 text-center text-[11px]">
          <div>
            <div className="font-semibold uppercase" style={{ color: GREEN }}>
              Người nộp tiền
            </div>
            <div className="text-stone-500">(Ký, ghi rõ họ tên)</div>
            <div className="mt-14">{customer?.name ?? ""}</div>
          </div>
          <div>
            <div className="font-semibold uppercase" style={{ color: GREEN }}>
              Người thu tiền
            </div>
            <div className="text-stone-500">(Ký, ghi rõ họ tên)</div>
            <div className="mt-14">{collector?.full_name ?? ""}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 border-t border-dashed border-stone-300 pt-3 text-center text-[11px]">
          <div className="font-medium text-amber-800">Cảm ơn quý khách đã tin tưởng và ủng hộ!</div>
          <div className="mt-2 font-bold" style={{ color: GREEN }}>
            {COMPANY_INFO.brandName}
          </div>
          <div className="italic text-stone-500">{COMPANY_INFO.slogan}</div>
        </div>
      </div>
    </div>
  );
}
