import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderActions } from "@/components/orders/order-actions";
import { TaskPriorityBadge, TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { formatDateTime, formatVnd } from "@/lib/utils";
import type {
  CustomerRow,
  OrderItemRow,
  OrderRow,
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

  const [customer, { results: items }, { results: tasks }] = await Promise.all([
    db.prepare(`SELECT * FROM customers WHERE id = ?`).bind(order.customer_id).first<CustomerRow>(),
    db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).bind(id).all<OrderItemRow>(),
    db.prepare(`SELECT * FROM tasks WHERE order_id = ? ORDER BY created_at DESC`).bind(id).all<TaskRow>(),
  ]);

  const hasActiveTask = tasks.some((t) => t.status !== "CANCELLED");

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
            <h1 className="text-xl font-bold text-stone-900">{order.order_code}</h1>
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
                      <th className="py-1.5 pr-3">SKU</th>
                      <th className="py-1.5 pr-3">Sản phẩm</th>
                      <th className="py-1.5 pr-3">SL</th>
                      <th className="py-1.5 pr-3">Đơn giá</th>
                      <th className="py-1.5 pr-3">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-stone-100">
                        <td className="py-1.5 pr-3 font-mono text-xs">{item.sku}</td>
                        <td className="py-1.5 pr-3">
                          {item.product_name}
                          <div className="text-xs text-stone-400">
                            {FORM_LABEL[item.form]} · {PACKAGING_LABEL[item.packaging]} ·{" "}
                            {item.weight_grams >= 1000 ? `${item.weight_grams / 1000}kg` : `${item.weight_grams}g`}
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
        </div>
      </div>
    </div>
  );
}
