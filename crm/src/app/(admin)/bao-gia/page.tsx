import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QuoteStatusBadge } from "@/components/quotations/quote-status-badge";
import { formatDate, formatVnd } from "@/lib/utils";
import { PlusCircle, Search } from "lucide-react";
import type { QuotationRow, UserRow } from "@/types/db";

const STATUS_TABS = [
  { label: "Tất cả", value: "" },
  { label: "Nháp", value: "DRAFT" },
  { label: "Đã gửi", value: "SENT" },
  { label: "Khách đã xem", value: "VIEWED" },
  { label: "Đã chấp nhận", value: "ACCEPTED" },
  { label: "Đã từ chối", value: "REJECTED" },
  { label: "Hết hạn", value: "EXPIRED" },
  { label: "Đã tạo đơn", value: "CONVERTED" },
];

export default async function QuotationsPage({ searchParams }: PageProps<"/bao-gia">) {
  const { status, q: qRaw, from, to, customerId } = await searchParams;
  const q = typeof qRaw === "string" ? qRaw.trim() : "";
  const db = getDb();

  const conditions: string[] = [];
  const args: unknown[] = [];
  if (typeof status === "string" && status) {
    conditions.push("qt.status = ?");
    args.push(status);
  }
  if (typeof customerId === "string" && customerId) {
    conditions.push("qt.customer_id = ?");
    args.push(customerId);
  }
  if (typeof from === "string" && from) {
    conditions.push("qt.quote_date >= ?");
    args.push(from);
  }
  if (typeof to === "string" && to) {
    conditions.push("qt.quote_date <= ?");
    args.push(to);
  }
  if (q) {
    conditions.push("(qt.quote_code LIKE ? OR qt.customer_name_snapshot LIKE ? OR qt.customer_phone_snapshot LIKE ?)");
    args.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { results: quotations } = await db
    .prepare(`SELECT qt.* FROM quotations qt ${where} ORDER BY qt.created_at DESC LIMIT 200`)
    .bind(...args)
    .all<QuotationRow>();

  const userIds = [...new Set(quotations.map((qt) => qt.created_by))];
  const userNames = new Map<string, string>();
  if (userIds.length > 0) {
    const placeholders = userIds.map(() => "?").join(",");
    const { results } = await db
      .prepare(`SELECT id, full_name FROM users WHERE id IN (${placeholders})`)
      .bind(...userIds)
      .all<Pick<UserRow, "id" | "full_name">>();
    results.forEach((u) => userNames.set(u.id, u.full_name));
  }

  const buildHref = (overrides: Record<string, string>) => {
    const sp = new URLSearchParams();
    if (typeof status === "string" && status) sp.set("status", status);
    if (q) sp.set("q", q);
    if (typeof from === "string" && from) sp.set("from", from);
    if (typeof to === "string" && to) sp.set("to", to);
    Object.entries(overrides).forEach(([k, v]) => (v ? sp.set(k, v) : sp.delete(k)));
    const qs = sp.toString();
    return qs ? `/bao-gia?${qs}` : "/bao-gia";
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">Báo giá</h1>
        <Link href="/bao-gia/new">
          <Button size="sm">
            <PlusCircle className="h-4 w-4" /> Tạo báo giá
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form action="/bao-gia" method="GET" className="relative flex-1">
          {typeof status === "string" && status && <input type="hidden" name="status" value={status} />}
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input type="text" name="q" defaultValue={q} placeholder="Tìm theo mã báo giá, tên/SĐT khách hàng..." className="pl-9" />
        </form>
        <form action="/bao-gia" method="GET" className="flex items-center gap-2">
          {typeof status === "string" && status && <input type="hidden" name="status" value={status} />}
          {q && <input type="hidden" name="q" value={q} />}
          <Input type="date" name="from" defaultValue={typeof from === "string" ? from : ""} className="w-[150px]" />
          <span className="text-sm text-stone-400">đến</span>
          <Input type="date" name="to" defaultValue={typeof to === "string" ? to : ""} className="w-[150px]" />
          <Button type="submit" size="sm" variant="outline">
            Lọc ngày
          </Button>
        </form>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_TABS.map((t) => (
          <Link
            key={t.value}
            href={buildHref({ status: t.value })}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              (typeof status === "string" ? status : "") === t.value
                ? "bg-amber-800 text-white"
                : "bg-white text-stone-600 border border-stone-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {quotations.length === 0 ? (
            <div className="py-8 text-center text-sm text-stone-500">Không có báo giá</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-stone-500">
                    <th className="p-3">Mã báo giá</th>
                    <th className="p-3">Ngày báo giá</th>
                    <th className="p-3">Khách hàng</th>
                    <th className="p-3">SĐT</th>
                    <th className="p-3 text-right">Tổng tiền</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3">Người tạo</th>
                    <th className="p-3">Hạn báo giá</th>
                    <th className="p-3">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {quotations.map((qt) => (
                    <tr key={qt.id} className="border-b border-stone-100 hover:bg-stone-50">
                      <td className="p-3 font-medium">
                        <Link href={`/bao-gia/${qt.id}`} className="text-amber-800 hover:underline">
                          {qt.quote_code}
                        </Link>
                      </td>
                      <td className="p-3 text-stone-600">{formatDate(qt.quote_date)}</td>
                      <td className="p-3">{qt.customer_name_snapshot}</td>
                      <td className="p-3 text-stone-600">{qt.customer_phone_snapshot ?? "—"}</td>
                      <td className="p-3 text-right font-medium">{formatVnd(qt.total_amount)}</td>
                      <td className="p-3">
                        <QuoteStatusBadge status={qt.status} />
                      </td>
                      <td className="p-3 text-stone-600">{userNames.get(qt.created_by) ?? "—"}</td>
                      <td className="p-3 text-stone-600">{qt.valid_until ? formatDate(qt.valid_until) : "—"}</td>
                      <td className="p-3">
                        <Link href={`/bao-gia/${qt.id}`} className="text-sm text-amber-800 hover:underline">
                          Xem
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
