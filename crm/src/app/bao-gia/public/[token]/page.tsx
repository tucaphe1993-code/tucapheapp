import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { COMPANY_INFO } from "@/lib/constants";
import { formatDate, formatVnd } from "@/lib/utils";
import { QuotePublicActions } from "@/components/quotations/quote-public-actions";
import { QuoteStatusBadge } from "@/components/quotations/quote-status-badge";
import type { QuotationItemRow, QuotationRow } from "@/types/db";

const GREEN = "#085D18";
const GREEN_LIGHT = "#E9F4EA";

// Trang công khai (KHÔNG đăng nhập) — khách mở link báo giá trên điện
// thoại, tra theo public_token riêng (không phải khóa chính quotations.id)
// giống hệt nguyên tắc bảo mật link công khai đã dùng cho /warranty.
export default async function PublicQuotationPage({ params }: PageProps<"/bao-gia/public/[token]">) {
  const { token } = await params;
  const db = getDb();

  const quotation = await db.prepare(`SELECT * FROM quotations WHERE public_token = ?`).bind(token).first<QuotationRow>();
  if (!quotation) notFound();

  // Đánh dấu "Khách đã xem" — chỉ 1 lần, không đè trạng thái đã chốt.
  if (quotation.status === "SENT") {
    await db
      .prepare(`UPDATE quotations SET status = 'VIEWED', viewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = 'SENT'`)
      .bind(quotation.id)
      .run();
    await db
      .prepare(`INSERT INTO quotation_events (id, quotation_id, action) VALUES (lower(hex(randomblob(16))), ?, 'VIEWED')`)
      .bind(quotation.id)
      .run();
    quotation.status = "VIEWED";
  }

  const { results: items } = await db
    .prepare(`SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order ASC`)
    .bind(quotation.id)
    .all<QuotationItemRow>();

  return (
    <div className="min-h-screen bg-stone-100 px-4 py-6">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-5 shadow-sm">
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
          Báo giá
        </h1>

        <div className="mt-3 flex items-center justify-between text-sm">
          <div className="text-stone-600">
            <div>
              Mã báo giá: <span className="font-semibold text-stone-900">{quotation.quote_code}</span>
            </div>
            <div>Ngày: {formatDate(quotation.quote_date)}</div>
            {quotation.valid_until && <div>Hiệu lực đến: {formatDate(quotation.valid_until)}</div>}
          </div>
          <QuoteStatusBadge status={quotation.status} />
        </div>

        <div className="mt-3 rounded-xl border border-stone-200 p-3 text-sm">
          <div className="font-semibold text-stone-900">{quotation.customer_name_snapshot}</div>
          {quotation.customer_company_snapshot && <div className="text-stone-600">{quotation.customer_company_snapshot}</div>}
          {quotation.customer_phone_snapshot && <div className="text-stone-600">SĐT: {quotation.customer_phone_snapshot}</div>}
          {quotation.customer_address_snapshot && <div className="text-stone-600">Địa chỉ: {quotation.customer_address_snapshot}</div>}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-stone-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-stone-900">{item.product_name}</div>
                  {item.description && <div className="text-xs text-stone-500">{item.description}</div>}
                  <div className="mt-0.5 text-xs text-stone-500">
                    {item.quantity} {item.unit} × {formatVnd(item.unit_price)}
                  </div>
                </div>
                <div className="shrink-0 font-semibold text-stone-900">{formatVnd(item.line_total)}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-1 border-t border-dashed border-stone-300 pt-3 text-sm">
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
          <div className="flex justify-between text-base font-bold" style={{ color: GREEN }}>
            <span>TỔNG CỘNG</span>
            <span>{formatVnd(quotation.total_amount)}</span>
          </div>
        </div>

        {quotation.note && (
          <div className="mt-3 rounded-xl p-3 text-sm" style={{ backgroundColor: GREEN_LIGHT }}>
            <div className="mb-1 text-xs font-bold uppercase" style={{ color: GREEN }}>
              Ghi chú
            </div>
            <div className="whitespace-pre-line text-stone-700">{quotation.note}</div>
          </div>
        )}

        <div className="mt-5">
          <QuotePublicActions token={token} status={quotation.status} />
        </div>

        <div className="mt-5 border-t border-dashed border-stone-300 pt-3 text-center text-xs text-stone-500">
          <div>
            Hotline:{" "}
            <span className="font-semibold" style={{ color: GREEN }}>
              {COMPANY_INFO.phone}
            </span>
          </div>
          <div className="mt-0.5">{COMPANY_INFO.address}</div>
        </div>
      </div>
    </div>
  );
}
