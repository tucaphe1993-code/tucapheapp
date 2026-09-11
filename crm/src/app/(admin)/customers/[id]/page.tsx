import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { CustomerPriceDialog } from "@/components/customers/customer-price-dialog";
import { CustomerPriceList, type CustomerPriceItem } from "@/components/customers/customer-price-list";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { DebtStatusBadge } from "@/components/orders/debt-status-badge";
import { InstallationStatusBadge } from "@/components/installations/installation-status-badge";
import { DeviceStatusBadge } from "@/components/devices/device-status-badge";
import { Button } from "@/components/ui/button";
import { computeDebtStatus } from "@/lib/services/debts";
import { formatDate, formatDateTime, formatVnd } from "@/lib/utils";
import type { CustomerRow, DeviceRow, InstallationRow, OrderRow, PaymentRow } from "@/types/db";

interface CustomerDeviceRow extends DeviceRow {
  product_name: string;
  sku: string;
}

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

  const { results: payments } = await db
    .prepare(`SELECT * FROM payments WHERE customer_id = ? ORDER BY paid_at DESC`)
    .bind(id)
    .all<PaymentRow>();

  const { results: installations } = await db
    .prepare(`SELECT * FROM installations WHERE customer_id = ? ORDER BY created_at DESC`)
    .bind(id)
    .all<InstallationRow>();

  const { results: devices } = await db
    .prepare(
      `SELECT d.*, p.name as product_name, pv.sku
       FROM devices d
       JOIN products p ON p.id = d.product_id
       JOIN product_variants pv ON pv.id = d.product_variant_id
       WHERE d.customer_id = ?
       ORDER BY d.sold_at DESC`
    )
    .bind(id)
    .all<CustomerDeviceRow>();

  const paidByOrder = new Map<string, number>();
  for (const p of payments) paidByOrder.set(p.order_id, (paidByOrder.get(p.order_id) ?? 0) + p.amount);

  const openOrders = orders.filter((o) => o.status !== "CANCELLED");
  const totalOwed = openOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const totalPaid = openOrders.reduce((sum, o) => sum + (paidByOrder.get(o.id) ?? 0), 0);
  const totalRemaining = Math.max(0, totalOwed - totalPaid);

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
          <CardTitle className="text-base">Công nợ</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="text-stone-500">Tổng đơn</div>
              <div className="font-medium">{formatVnd(totalOwed)}</div>
            </div>
            <div>
              <div className="text-stone-500">Đã thanh toán</div>
              <div className="font-medium text-emerald-700">{formatVnd(totalPaid)}</div>
            </div>
            <div>
              <div className="text-stone-500">Còn nợ</div>
              <div className="font-medium text-red-700">{formatVnd(totalRemaining)}</div>
            </div>
          </div>
          {payments.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-stone-100 pt-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <span className="text-stone-500">
                    {formatDate(p.paid_at)} {p.method ? `· ${p.method}` : ""}
                  </span>
                  <span className="font-medium">{formatVnd(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thiết bị đang sở hữu ({devices.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {devices.length === 0 && (
            <div className="py-4 text-center text-sm text-stone-500">Chưa có thiết bị nào</div>
          )}
          {devices.map((d) => (
            <Link
              key={d.id}
              href={`/devices/${d.id}`}
              className="flex items-center justify-between rounded-lg border border-stone-200 p-3 hover:border-amber-300"
            >
              <div>
                <div className="font-medium">
                  {d.product_name} <span className="text-stone-400 font-normal font-mono">· {d.serial_number}</span>
                </div>
                <div className="text-xs text-stone-500">
                  {d.warranty_end_date ? `Bảo hành đến ${formatDate(d.warranty_end_date)}` : "Chưa có thông tin bảo hành"}
                </div>
              </div>
              <DeviceStatusBadge status={d.status} />
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lịch sử lắp đặt ({installations.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {installations.length === 0 && (
            <div className="py-4 text-center text-sm text-stone-500">Chưa có lắp đặt</div>
          )}
          {installations.map((inst) => (
            <Link
              key={inst.id}
              href={`/installations/${inst.id}`}
              className="flex items-center justify-between rounded-lg border border-stone-200 p-3 hover:border-amber-300"
            >
              <div>
                <div className="font-medium">{inst.equipment}</div>
                <div className="text-xs text-stone-500">
                  {inst.serial_number ? `Serial: ${inst.serial_number} · ` : ""}
                  {inst.handed_over_at
                    ? `Bàn giao: ${formatDateTime(inst.handed_over_at)}`
                    : inst.scheduled_at
                      ? `Ngày lắp: ${formatDateTime(inst.scheduled_at)}`
                      : "Chưa lên lịch"}
                </div>
              </div>
              <InstallationStatusBadge status={inst.status} />
            </Link>
          ))}
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
          {orders.map((o) => {
            const debtStatus =
              o.status !== "CANCELLED"
                ? computeDebtStatus({
                    totalAmount: o.total_amount,
                    paidAmount: paidByOrder.get(o.id) ?? 0,
                    dueDate: o.payment_due_date,
                  })
                : null;
            return (
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
                  {debtStatus && <DebtStatusBadge status={debtStatus} />}
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
