import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { CustomerPriceDialog } from "@/components/customers/customer-price-dialog";
import { CustomerPriceList, type CustomerPriceItem } from "@/components/customers/customer-price-list";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatVnd } from "@/lib/utils";
import type { CustomerRow, OrderRow } from "@/types/db";

export default async function CustomerDetailPage({
  params,
}: PageProps<"/customers/[id]">) {
  const { id } = await params;
  const db = getDb();

  const customer = await db
    .prepare(`SELECT * FROM customers WHERE id = ?`)
    .bind(id)
    .first<CustomerRow>();
  if (!customer) notFound();

  const { results: orders } = await db
    .prepare(`SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC`)
    .bind(id)
    .all<OrderRow>();

  const { results: prices } = await db
    .prepare(
      `SELECT cp.*, pv.form, pv.packaging, pv.weight_grams, pv.unit_price as default_unit_price,
              p.name as product_name
       FROM customer_prices cp
       JOIN product_variants pv ON pv.id = cp.product_variant_id
       JOIN products p ON p.id = pv.product_id
       WHERE cp.customer_id = ?
       ORDER BY p.name ASC, pv.weight_grams ASC`
    )
    .bind(id)
    .all<CustomerPriceItem>();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">{customer.name}</h1>
        <CustomerFormDialog
          customer={customer}
          trigger={<Button variant="outline" size="sm">Sửa</Button>}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin khách hàng</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="text-stone-500">Số điện thoại: </span>
            {customer.phone || "—"}
          </div>
          <div>
            <span className="text-stone-500">Email: </span>
            {customer.email || "—"}
          </div>
          <div>
            <span className="text-stone-500">Tỉnh/thành: </span>
            {customer.province || "—"}
          </div>
          <div>
            <span className="text-stone-500">Địa chỉ: </span>
            {customer.address || "—"}
          </div>
          {customer.note && (
            <div className="sm:col-span-2">
              <span className="text-stone-500">Ghi chú: </span>
              {customer.note}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Giá riêng ({prices.length})</CardTitle>
          <CustomerPriceDialog customerId={id} />
        </CardHeader>
        <CardContent>
          <CustomerPriceList customerId={id} prices={prices} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lịch sử đơn hàng ({orders.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {orders.length === 0 && (
            <div className="py-4 text-center text-sm text-stone-500">Chưa có đơn hàng</div>
          )}
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className="flex items-center justify-between rounded-lg border border-stone-200 p-3 hover:border-amber-300"
            >
              <div>
                <div className="font-medium">{formatDate(o.created_at)}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="font-medium">{formatVnd(o.total_amount)}</div>
                <OrderStatusBadge status={o.status} />
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
