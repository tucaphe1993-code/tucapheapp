import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderActions } from "@/components/orders/order-actions";
import { DebtStatusBadge } from "@/components/orders/debt-status-badge";
import { RecordPaymentDialog } from "@/components/orders/record-payment-dialog";
import { DueDateDialog } from "@/components/orders/due-date-dialog";
import { InstallationDialog } from "@/components/orders/installation-dialog";
import { InstallationStatusBadge } from "@/components/installations/installation-status-badge";
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { computeDebtStatus } from "@/lib/services/debts";
import { formatDate, formatDateTime, formatVnd } from "@/lib/utils";
import type {
  CustomerRow,
  DeviceRow,
  InstallationRow,
  OrderItemRow,
  OrderRow,
  PaymentRow,
  ReportImageRow,
  ReportRow,
  TaskChecklistRow,
  TaskRow,
  UserRow,
} from "@/types/db";

const FORM_LABEL: Record<string, string> = { HAT: "Hạt", BOT: "Bột" };
const PACKAGING_LABEL: Record<string, string> = { TUI_XANH: "Túi Xanh", TUI_ZIP: "Túi Zip" };

export default async function OrderDetailPage({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const db = getDb();

  const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first<OrderRow>();
  if (!order) notFound();

  const [customer, { results: items }, { results: tasks }, { results: payments }, { results: installations }] =
    await Promise.all([
      db.prepare(`SELECT * FROM customers WHERE id = ?`).bind(order.customer_id).first<CustomerRow>(),
      db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).bind(id).all<OrderItemRow>(),
      db.prepare(`SELECT * FROM tasks WHERE order_id = ? ORDER BY created_at DESC`).bind(id).all<TaskRow>(),
      db.prepare(`SELECT * FROM payments WHERE order_id = ? ORDER BY paid_at DESC`).bind(id).all<PaymentRow>(),
      db
        .prepare(`SELECT * FROM installations WHERE order_id = ? ORDER BY created_at DESC`)
        .bind(id)
        .all<InstallationRow>(),
    ]);

  const hasActiveTask = tasks.some((t) => t.status !== "CANCELLED");
  const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, order.total_amount - paidAmount);
  const debtStatus = computeDebtStatus({
    totalAmount: order.total_amount,
    paidAmount,
    dueDate: order.payment_due_date,
  });

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

  const technicianIds = [...new Set(installations.map((i) => i.technician_id).filter((v): v is string => !!v))];
  const technicianNames = new Map<string, string>();
  if (technicianIds.length > 0) {
    const placeholders = technicianIds.map(() => "?").join(",");
    const { results } = await db
      .prepare(`SELECT id, full_name FROM users WHERE id IN (${placeholders})`)
      .bind(...technicianIds)
      .all<{ id: string; full_name: string }>();
    results.forEach((r) => technicianNames.set(r.id, r.full_name));
  }

  const taskDetails = await Promise.all(
    tasks.map(async (task) => {
      const [assignee, { results: checklist }, report, { results: images }] = await Promise.all([
        db.prepare(`SELECT * FROM users WHERE id = ?`).bind(task.assigned_to).first<UserRow>(),
        db
          .prepare(`SELECT * FROM task_checklists WHERE task_id = ? ORDER BY sort_order ASC`)
          .bind(task.id)
          .all<TaskChecklistRow>(),
        db.prepare(`SELECT * FROM reports WHERE task_id = ?`).bind(task.id).first<ReportRow>(),
        db
          .prepare(`SELECT * FROM report_images WHERE task_id = ? ORDER BY created_at ASC`)
          .bind(task.id)
          .all<ReportImageRow>(),
      ]);
      return { task, assignee, checklist, report, images };
    })
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-stone-900">{customer?.name ?? "Đơn hàng"}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <div className="text-sm text-stone-500">Tạo lúc {formatDateTime(order.created_at)}</div>
        </div>
        <OrderActions order={order} hasActiveTask={hasActiveTask} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sản phẩm</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-left text-stone-500">
                      <th className="py-1.5 pr-3">Sản phẩm</th>
                      <th className="py-1.5 pr-3">SL</th>
                      <th className="py-1.5 pr-3">Đơn giá</th>
                      <th className="py-1.5 pr-3">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-stone-100">
                        <td className="py-1.5 pr-3">
                          {item.product_name}
                          <div className="text-xs text-stone-400">
                            {item.device_id ? (
                              <>
                                Serial:{" "}
                                <Link href={`/devices/${item.device_id}`} className="text-amber-800 hover:underline">
                                  {deviceSerials.get(item.device_id) ?? "—"}
                                </Link>
                              </>
                            ) : item.form ? (
                              <>
                                {FORM_LABEL[item.form]} · {PACKAGING_LABEL[item.packaging!]} ·{" "}
                                {item.weight_grams! >= 1000
                                  ? `${item.weight_grams! / 1000}kg`
                                  : `${item.weight_grams}g`}
                              </>
                            ) : (
                              item.sku
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 pr-3">{item.quantity}</td>
                        <td className="py-1.5 pr-3">{formatVnd(item.unit_price)}</td>
                        <td className="py-1.5 pr-3 font-medium">{formatVnd(item.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="pt-2 text-right font-semibold">
                        Tổng cộng
                      </td>
                      <td className="pt-2 font-semibold">{formatVnd(order.total_amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {taskDetails.map(({ task, assignee, checklist, report, images }) => {
            const checkedCount = checklist.filter((c) => c.is_checked).length;
            return (
              <Card key={task.id}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">Công việc đóng gói</CardTitle>
                    <div className="text-sm text-stone-500">
                      Giao cho: {assignee?.full_name ?? "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TaskPriorityBadge priority={task.priority} />
                    <TaskStatusBadge status={task.status} />
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="text-sm text-stone-600">
                    Checklist: {checkedCount}/{checklist.length} mục đã hoàn thành
                  </div>
                  {report?.note && (
                    <div className="rounded-lg bg-stone-50 p-3 text-sm">
                      <div className="font-medium">Ghi chú báo cáo</div>
                      <div className="text-stone-600">{report.note}</div>
                    </div>
                  )}
                  {images.length > 0 && (
                    <div>
                      <div className="mb-1 text-sm font-medium">Ảnh báo cáo ({images.length})</div>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {images.map((img) => (
                          <a
                            key={img.id}
                            href={img.image_url}
                            target="_blank"
                            rel="noreferrer"
                            className="relative aspect-square overflow-hidden rounded-lg bg-stone-100"
                          >
                            <Image src={img.image_url} alt="Ảnh báo cáo" fill className="object-cover" unoptimized />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Khách hàng</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-sm">
              <Link href={`/customers/${customer?.id}`} className="font-medium text-amber-800 hover:underline">
                {customer?.name}
              </Link>
              <div className="text-stone-600">{order.customer_phone_snapshot}</div>
              <div className="text-stone-600">{order.customer_address_snapshot}</div>
              {order.delivery_date && (
                <div className="text-stone-500">Ngày giao: {order.delivery_date}</div>
              )}
              {order.delivery_method && (
                <div className="text-stone-500">Hình thức giao: {order.delivery_method}</div>
              )}
              {order.note && <div className="text-stone-500">Ghi chú: {order.note}</div>}
            </CardContent>
          </Card>

          {order.status !== "CANCELLED" && (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Công nợ</CardTitle>
                <DebtStatusBadge status={debtStatus} />
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-500">Tổng tiền</span>
                  <span className="font-medium">{formatVnd(order.total_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Đã thanh toán</span>
                  <span className="font-medium text-emerald-700">{formatVnd(paidAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Còn nợ</span>
                  <span className="font-medium text-red-700">{formatVnd(remaining)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Hạn thanh toán</span>
                  <span className="font-medium">
                    {order.payment_due_date ? formatDate(order.payment_due_date) : "—"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {remaining > 0 && <RecordPaymentDialog orderId={order.id} />}
                  <DueDateDialog orderId={order.id} currentDueDate={order.payment_due_date} />
                </div>
                {payments.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5 border-t border-stone-100 pt-2">
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
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Lắp đặt</CardTitle>
              {order.status !== "CANCELLED" && (
                <InstallationDialog orderId={order.id} defaultLocation={order.customer_address_snapshot} />
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {installations.length === 0 && (
                <div className="py-2 text-center text-sm text-stone-500">Không có lắp đặt</div>
              )}
              {installations.map((inst) => (
                <Link
                  key={inst.id}
                  href={`/installations/${inst.id}`}
                  className="flex items-center justify-between rounded-lg border border-stone-200 p-2.5 text-sm hover:border-amber-300"
                >
                  <div>
                    <div className="font-medium">{inst.equipment}</div>
                    <div className="text-xs text-stone-500">
                      {technicianNames.get(inst.technician_id ?? "") ?? "Chưa phân công"}
                    </div>
                  </div>
                  <InstallationStatusBadge status={inst.status} />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
