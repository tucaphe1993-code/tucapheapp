import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuoteStatusBadge } from "@/components/quotations/quote-status-badge";
import { QuotationActions } from "@/components/quotations/quotation-actions";
import { formatDate, formatDateTime, formatVnd } from "@/lib/utils";
import type { QuotationEventRow, QuotationItemRow, QuotationRow, UserRow } from "@/types/db";

const PRICE_TYPE_LABEL: Record<string, string> = {
  RETAIL: "Giá lẻ",
  WHOLESALE: "Giá sỉ",
  AGENT: "Giá đại lý",
  CUSTOM: "Giá tùy chỉnh",
};

const EVENT_LABEL: Record<string, string> = {
  CREATED: "Tạo báo giá",
  EDITED: "Chỉnh sửa báo giá",
  SENT: "Đã gửi khách",
  VIEWED: "Khách đã xem",
  ACCEPTED: "Khách chấp nhận",
  REJECTED: "Khách từ chối",
  CONVERTED: "Chuyển thành đơn hàng",
};

export default async function QuotationDetailPage({ params }: PageProps<"/bao-gia/[id]">) {
  const { id } = await params;
  const db = getDb();

  const quotation = await db.prepare(`SELECT * FROM quotations WHERE id = ?`).bind(id).first<QuotationRow>();
  if (!quotation) notFound();

  const [{ results: items }, { results: events }, assignedUser, createdUser] = await Promise.all([
    db.prepare(`SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order ASC`).bind(id).all<QuotationItemRow>(),
    db.prepare(`SELECT * FROM quotation_events WHERE quotation_id = ? ORDER BY created_at ASC`).bind(id).all<QuotationEventRow>(),
    quotation.assigned_to
      ? db.prepare(`SELECT * FROM users WHERE id = ?`).bind(quotation.assigned_to).first<UserRow>()
      : Promise.resolve(null),
    db.prepare(`SELECT * FROM users WHERE id = ?`).bind(quotation.created_by).first<UserRow>(),
  ]);

  const eventUserIds = [...new Set(events.map((e) => e.user_id).filter((v): v is string => !!v))];
  const eventUserNames = new Map<string, string>();
  if (eventUserIds.length > 0) {
    const placeholders = eventUserIds.map(() => "?").join(",");
    const { results } = await db
      .prepare(`SELECT id, full_name FROM users WHERE id IN (${placeholders})`)
      .bind(...eventUserIds)
      .all<Pick<UserRow, "id" | "full_name">>();
    results.forEach((u) => eventUserNames.set(u.id, u.full_name));
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Báo giá {quotation.quote_code}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-500">
            <span>Ngày: {formatDate(quotation.quote_date)}</span>
            {quotation.valid_until && <span>Hiệu lực đến: {formatDate(quotation.valid_until)}</span>}
            {quotation.converted_order_id && (
              <Link href={`/orders/${quotation.converted_order_id}`} className="text-amber-800 hover:underline">
                → Đơn hàng đã tạo
              </Link>
            )}
          </div>
        </div>
        <QuoteStatusBadge status={quotation.status} />
      </div>

      <QuotationActions quotation={quotation} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Khách hàng</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {quotation.customer_id ? (
              <Link href={`/customers/${quotation.customer_id}`} className="font-medium text-amber-800 hover:underline">
                {quotation.customer_name_snapshot}
              </Link>
            ) : (
              <div className="font-medium">{quotation.customer_name_snapshot}</div>
            )}
            {quotation.customer_company_snapshot && <div className="text-stone-600">{quotation.customer_company_snapshot}</div>}
            {quotation.customer_phone_snapshot && <div className="text-stone-600">SĐT: {quotation.customer_phone_snapshot}</div>}
            {quotation.customer_address_snapshot && <div className="text-stone-600">Địa chỉ: {quotation.customer_address_snapshot}</div>}
            {quotation.customer_tax_code_snapshot && <div className="text-stone-600">MST: {quotation.customer_tax_code_snapshot}</div>}
            {quotation.customer_email_snapshot && <div className="text-stone-600">Email: {quotation.customer_email_snapshot}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thông tin báo giá</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <div className="text-stone-600">Loại báo giá: {PRICE_TYPE_LABEL[quotation.price_type]}</div>
            <div className="text-stone-600">Người tạo: {createdUser?.full_name ?? "—"}</div>
            <div className="text-stone-600">Nhân viên phụ trách: {assignedUser?.full_name ?? "—"}</div>
            {quotation.reject_reason && <div className="text-red-600">Lý do từ chối: {quotation.reject_reason}</div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sản phẩm</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="py-1.5 pr-2">#</th>
                  <th className="py-1.5 pr-2">Sản phẩm</th>
                  <th className="py-1.5 pr-2">ĐVT</th>
                  <th className="py-1.5 pr-2 text-right">SL</th>
                  <th className="py-1.5 pr-2 text-right">Đơn giá</th>
                  <th className="py-1.5 pr-2 text-right">CK</th>
                  <th className="py-1.5 pr-2 text-right">VAT</th>
                  <th className="py-1.5 pr-2 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id} className="border-b border-stone-100">
                    <td className="py-1.5 pr-2">{idx + 1}</td>
                    <td className="py-1.5 pr-2">
                      <div>
                        {item.product_name}
                        {item.is_reference === 1 && (
                          <span className="ml-1.5 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">
                            Tham khảo
                          </span>
                        )}
                      </div>
                      {item.description && <div className="text-xs text-stone-500">{item.description}</div>}
                    </td>
                    <td className="py-1.5 pr-2">{item.unit}</td>
                    <td className="py-1.5 pr-2 text-right">{item.quantity}</td>
                    <td className="py-1.5 pr-2 text-right">{formatVnd(item.unit_price)}</td>
                    {item.is_reference === 1 ? (
                      <>
                        <td className="py-1.5 pr-2 text-right text-stone-400">—</td>
                        <td className="py-1.5 pr-2 text-right text-stone-400">—</td>
                        <td className="py-1.5 pr-2 text-right text-stone-400">—</td>
                      </>
                    ) : (
                      <>
                        <td className="py-1.5 pr-2 text-right">
                          {item.discount_amount > 0 ? formatVnd(item.discount_amount) : item.discount_percent > 0 ? `${item.discount_percent}%` : "—"}
                        </td>
                        <td className="py-1.5 pr-2 text-right">{item.vat_percent > 0 ? `${item.vat_percent}%` : "—"}</td>
                        <td className="py-1.5 pr-2 text-right font-medium">{formatVnd(item.line_total)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.some((i) => i.is_reference === 1) && (
            <div className="mt-2 text-xs text-stone-400">* Dòng &quot;Tham khảo&quot; chỉ để tham khảo giá, không tính vào Tạm tính/Tổng cộng.</div>
          )}
          <div className="mt-3 ml-auto flex max-w-xs flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">Tạm tính</span>
              <span>{formatVnd(quotation.subtotal)}</span>
            </div>
            {quotation.discount_amount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Chiết khấu</span>
                <span>-{formatVnd(quotation.discount_amount)}</span>
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
            <div className="flex justify-between border-t border-stone-200 pt-1 text-base font-semibold">
              <span>Tổng cộng</span>
              <span>{formatVnd(quotation.total_amount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {quotation.note && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ghi chú</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-line text-sm text-stone-600">{quotation.note}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lịch sử</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {events.length === 0 && <div className="text-sm text-stone-400">Chưa có lịch sử</div>}
          {events.map((ev) => (
            <div key={ev.id} className="flex items-start gap-3 text-sm">
              <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-700" />
              <div>
                <div>
                  <span className="text-stone-500">{formatDateTime(ev.created_at)}</span> — {EVENT_LABEL[ev.action] ?? ev.action}
                  {ev.user_id && eventUserNames.get(ev.user_id) && (
                    <span className="text-stone-500"> ({eventUserNames.get(ev.user_id)})</span>
                  )}
                </div>
                {ev.note && <div className="text-stone-500">{ev.note}</div>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
