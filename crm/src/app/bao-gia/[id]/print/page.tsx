import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { COMPANY_INFO } from "@/lib/constants";
import { PrintButton } from "@/components/print-button";
import { formatDate, formatVnd } from "@/lib/utils";
import type { QuotationItemRow, QuotationRow } from "@/types/db";

const GREEN = "#085D18";
const GREEN_LIGHT = "#E9F4EA";
const CREAM = "#FBF6EC";

const PRICE_TYPE_LABEL: Record<string, string> = {
  RETAIL: "Giá lẻ",
  WHOLESALE: "Giá sỉ",
  AGENT: "Giá đại lý",
  CUSTOM: "Giá tùy chỉnh",
};

// Cùng auth guard với các trang in khác (orders/print, protocols/print) —
// đứng ngoài route group (admin) nên tự kiểm tra session/role riêng.
export default async function QuotationPrintPage({ params }: PageProps<"/bao-gia/[id]/print">) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/my-tasks");

  const { id } = await params;
  const db = getDb();

  const quotation = await db.prepare(`SELECT * FROM quotations WHERE id = ?`).bind(id).first<QuotationRow>();
  if (!quotation) notFound();

  const { results: items } = await db
    .prepare(`SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order ASC`)
    .bind(id)
    .all<QuotationItemRow>();

  return (
    <div className="min-h-screen bg-stone-100 py-6 print:bg-white print:py-0">
      <style>{`
        @page { size: A4 portrait; margin: 12mm; }
        @media print { tr { break-inside: avoid; } }
      `}</style>

      <div className="mx-auto flex max-w-[186mm] justify-end px-4 pb-3 print:hidden">
        <PrintButton />
      </div>

      <div className="relative mx-auto max-w-[186mm] bg-white p-8 text-[11px] leading-snug text-stone-900 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        {/* Header */}
        <div className="flex items-start gap-4 border-b-2 pb-4" style={{ borderColor: GREEN }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-tucaphe.png" alt="Tú Cà Phê" className="h-20 w-20 shrink-0" />
          <div>
            <div className="text-xl font-bold" style={{ color: GREEN }}>
              {COMPANY_INFO.brandName}
            </div>
            <div className="text-[11px] italic text-amber-800">{COMPANY_INFO.slogan}</div>
            <div className="mt-1 text-[10px] font-semibold text-stone-500">{COMPANY_INFO.name}</div>
            <div className="mt-1 text-[10px] text-stone-600">
              Địa chỉ: {COMPANY_INFO.address} &nbsp;·&nbsp; Hotline: {COMPANY_INFO.phone} &nbsp;·&nbsp; Email: {COMPANY_INFO.email}
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="mt-4 text-center">
          <h1 className="text-2xl font-bold uppercase tracking-wide" style={{ color: GREEN }}>
            Báo giá
          </h1>
        </div>

        <div className="mt-3 flex justify-between border-b border-dashed border-stone-300 pb-2 text-[11px]">
          <div>
            <span className="text-stone-500">Mã báo giá: </span>
            <span className="font-semibold">{quotation.quote_code}</span>
          </div>
          <div>
            <span className="text-stone-500">Ngày: </span>
            <span className="font-semibold">{formatDate(quotation.quote_date)}</span>
          </div>
          {quotation.valid_until && (
            <div>
              <span className="text-stone-500">Hiệu lực đến: </span>
              <span className="font-semibold">{formatDate(quotation.valid_until)}</span>
            </div>
          )}
        </div>

        {/* Customer */}
        <div className="mt-3 rounded-lg border border-stone-200 p-3" style={{ backgroundColor: CREAM }}>
          <div className="mb-1.5 text-[10.5px] font-bold uppercase" style={{ color: GREEN }}>
            Kính gửi: {quotation.customer_name_snapshot}
          </div>
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              {quotation.customer_company_snapshot && (
                <tr>
                  <td className="w-[20%] py-0.5 text-stone-500">Đơn vị</td>
                  <td className="py-0.5 font-medium">{quotation.customer_company_snapshot}</td>
                </tr>
              )}
              <tr>
                <td className="py-0.5 text-stone-500">SĐT</td>
                <td className="py-0.5">{quotation.customer_phone_snapshot ?? "—"}</td>
              </tr>
              <tr>
                <td className="py-0.5 text-stone-500">Địa chỉ</td>
                <td className="py-0.5">{quotation.customer_address_snapshot ?? "—"}</td>
              </tr>
              {quotation.customer_tax_code_snapshot && (
                <tr>
                  <td className="py-0.5 text-stone-500">MST</td>
                  <td className="py-0.5">{quotation.customer_tax_code_snapshot}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Items */}
        <div className="mt-3">
          <div className="mb-1.5 text-[10.5px] font-bold uppercase" style={{ color: GREEN }}>
            Bảng báo giá ({PRICE_TYPE_LABEL[quotation.price_type]})
          </div>
          <table className="w-full border-collapse text-[10.5px]">
            <thead>
              <tr style={{ backgroundColor: GREEN_LIGHT }}>
                <th className="border border-stone-300 p-1.5 text-center" style={{ color: GREEN }}>STT</th>
                <th className="border border-stone-300 p-1.5 text-left" style={{ color: GREEN }}>Sản phẩm</th>
                <th className="border border-stone-300 p-1.5 text-center" style={{ color: GREEN }}>ĐVT</th>
                <th className="border border-stone-300 p-1.5 text-center" style={{ color: GREEN }}>SL</th>
                <th className="border border-stone-300 p-1.5 text-right" style={{ color: GREEN }}>Đơn giá</th>
                <th className="border border-stone-300 p-1.5 text-center" style={{ color: GREEN }}>CK</th>
                <th className="border border-stone-300 p-1.5 text-center" style={{ color: GREEN }}>VAT</th>
                <th className="border border-stone-300 p-1.5 text-right" style={{ color: GREEN }}>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id}>
                  <td className="border border-stone-300 p-1.5 text-center">{idx + 1}</td>
                  <td className="border border-stone-300 p-1.5">
                    {item.product_name}
                    {item.is_reference === 1 && <span className="ml-1 text-[9px] italic text-stone-400">(tham khảo)</span>}
                    {item.description && <div className="text-[9px] text-stone-500">{item.description}</div>}
                  </td>
                  <td className="border border-stone-300 p-1.5 text-center">{item.unit}</td>
                  <td className="border border-stone-300 p-1.5 text-center">{item.quantity}</td>
                  <td className="border border-stone-300 p-1.5 text-right">{formatVnd(item.unit_price)}</td>
                  {item.is_reference === 1 ? (
                    <>
                      <td className="border border-stone-300 p-1.5 text-center text-stone-400">—</td>
                      <td className="border border-stone-300 p-1.5 text-center text-stone-400">—</td>
                      <td className="border border-stone-300 p-1.5 text-right text-stone-400">—</td>
                    </>
                  ) : (
                    <>
                      <td className="border border-stone-300 p-1.5 text-center">
                        {item.discount_amount > 0 ? formatVnd(item.discount_amount) : item.discount_percent > 0 ? `${item.discount_percent}%` : "—"}
                      </td>
                      <td className="border border-stone-300 p-1.5 text-center">{item.vat_percent > 0 ? `${item.vat_percent}%` : "—"}</td>
                      <td className="border border-stone-300 p-1.5 text-right font-medium">{formatVnd(item.line_total)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {items.some((i) => i.is_reference === 1) && (
            <div className="mt-1 text-[9px] text-stone-400">(tham khảo): giá tham khảo, không tính vào tổng báo giá.</div>
          )}
        </div>

        {/* Totals */}
        <div className="mt-3 flex flex-col gap-1 border-t border-dashed border-stone-300 pt-2 text-[11px]">
          <div className="flex justify-between">
            <span className="text-stone-500">Tạm tính</span>
            <span>{formatVnd(quotation.subtotal)}</span>
          </div>
          {quotation.discount_amount > 0 && (
            <div className="flex justify-between">
              <span className="text-stone-500">Chiết khấu</span>
              <span className="text-red-600">-{formatVnd(quotation.discount_amount)}</span>
            </div>
          )}
          {quotation.vat_amount > 0 && (
            <div className="flex justify-between">
              <span className="text-stone-500">VAT</span>
              <span>{formatVnd(quotation.vat_amount)}</span>
            </div>
          )}
          {quotation.shipping_fee > 0 && (
            <div className="flex justify-between">
              <span className="text-stone-500">Vận chuyển</span>
              <span>{formatVnd(quotation.shipping_fee)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-stone-300 pt-1 text-sm font-bold">
            <span>TỔNG CỘNG</span>
            <span style={{ color: GREEN }}>{formatVnd(quotation.total_amount)}</span>
          </div>
        </div>

        {/* Note */}
        {quotation.note && (
          <div className="mt-3 rounded-lg border border-stone-200 p-3" style={{ backgroundColor: GREEN_LIGHT }}>
            <div className="mb-1 text-[10.5px] font-bold uppercase" style={{ color: GREEN }}>
              Ghi chú
            </div>
            <div className="whitespace-pre-line text-[10.5px] text-stone-700">{quotation.note}</div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 border-t border-dashed border-stone-300 pt-3 text-center text-[10px] text-stone-500">
          <div>Trân trọng cảm ơn Quý khách đã quan tâm và đồng hành cùng {COMPANY_INFO.brandName}.</div>
          <div className="mt-2 font-bold" style={{ color: GREEN }}>
            {COMPANY_INFO.brandName}
          </div>
          <div className="italic">{COMPANY_INFO.slogan}</div>
        </div>
      </div>
    </div>
  );
}
