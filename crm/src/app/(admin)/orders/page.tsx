import Link from "next/link";
import { Search } from "lucide-react";
import { getDb } from "@/lib/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { SalesOrderQuickDialog } from "@/components/orders/sales-order-quick-dialog";
import { formatDate, formatVnd } from "@/lib/utils";
import type { OrderRow } from "@/types/db";

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const { status, q: qRaw } = await searchParams;
  const q = typeof qRaw === "string" ? qRaw.trim() : "";
  const db = getDb();

  // Tìm theo mã đơn/tên/SĐT/CCCD — dùng khi khách gọi bảo hành chỉ nhớ mã
  // phiếu hoặc CCCD, không nhớ đã mua lúc nào để lọc theo trạng thái. Có q
  // thì bỏ qua bộ lọc trạng thái, tìm xuyên suốt toàn bộ đơn hàng.
  const stmt = q
    ? db
        .prepare(
          `SELECT o.* FROM orders o JOIN customers c ON c.id = o.customer_id
           WHERE o.order_code LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR c.id_card_number LIKE ?
           ORDER BY o.created_at DESC LIMIT 200`
        )
        .bind(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
    : status
      ? db.prepare(`SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT 200`).bind(status)
      : db.prepare(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 200`);
  const { results: orders } = await stmt.all<OrderRow & { customer_name?: string }>();

  const customerIds = [...new Set(orders.map((o) => o.customer_id))];
  const customerNames = new Map<string, string>();
  if (customerIds.length > 0) {
    const placeholders = customerIds.map(() => "?").join(",");
    const { results } = await db
      .prepare(`SELECT id, name FROM customers WHERE id IN (${placeholders})`)
      .bind(...customerIds)
      .all<{ id: string; name: string }>();
    results.forEach((r) => customerNames.set(r.id, r.name));
  }

  const tabs = [
    { label: "Tất cả", value: "" },
    { label: "Đã xác nhận", value: "CONFIRMED" },
    { label: "Đang đóng gói", value: "PACKING" },
    { label: "Đã đóng gói", value: "PACKED" },
    { label: "Đã giao", value: "SHIPPED" },
    { label: "Hoàn thành", value: "COMPLETED" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">Đơn hàng</h1>
        <div className="flex items-center gap-3">
          <Link href="/orders/new" className="text-sm font-medium text-amber-800 hover:underline">
            + Đơn cà phê
          </Link>
          <Link href="/orders/new-equipment" className="text-sm font-medium text-amber-800 hover:underline">
            + Đơn thiết bị
          </Link>
          <SalesOrderQuickDialog />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <form action="/orders" method="GET" className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Tìm theo mã đơn, tên/SĐT/CCCD khách hàng..."
            className="pl-9"
          />
        </form>
        {q && (
          <Link href="/orders" className="text-sm text-stone-500 hover:underline">
            Xóa tìm kiếm
          </Link>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={t.value ? `/orders?status=${t.value}` : "/orders"}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              (status ?? "") === t.value
                ? "bg-amber-800 text-white"
                : "bg-white text-stone-600 border border-stone-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {orders.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-stone-500">Không có đơn hàng</CardContent>
          </Card>
        )}
        {orders.map((o) => (
          <Link key={o.id} href={`/orders/${o.id}`}>
            <Card className="hover:border-amber-300">
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">{customerNames.get(o.customer_id) ?? "—"}</div>
                  <div className="text-sm text-stone-500">
                    {o.order_code} · {formatDate(o.created_at)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-medium">{formatVnd(o.total_amount)}</div>
                  <OrderStatusBadge status={o.status} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
