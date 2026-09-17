import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PurchaseOrderActions } from "@/components/purchasing/purchase-order-actions";
import { SupplierPaymentDialog } from "@/components/purchasing/supplier-payment-dialog";
import { formatDateTime, formatVnd } from "@/lib/utils";
import type { PurchaseOrderItemRow, PurchaseOrderRow, PurchaseOrderStatus, SupplierPaymentRow, SupplierRow } from "@/types/db";

const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Nháp — chưa nhập kho, chưa phát sinh công nợ",
  CONFIRMED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};
const STATUS_BADGE: Record<PurchaseOrderStatus, "success" | "warning" | "secondary"> = {
  DRAFT: "warning",
  CONFIRMED: "success",
  CANCELLED: "secondary",
};

export default async function PurchaseOrderDetailPage({ params }: PageProps<"/purchasing/[id]">) {
  const { id } = await params;
  const db = getDb();

  const po = await db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).bind(id).first<PurchaseOrderRow>();
  if (!po) notFound();

  const [supplier, items, payments] = await Promise.all([
    db.prepare(`SELECT * FROM suppliers WHERE id = ?`).bind(po.supplier_id).first<SupplierRow>(),
    db.prepare(`SELECT * FROM purchase_order_items WHERE purchase_order_id = ?`).bind(id).all<PurchaseOrderItemRow>(),
    db
      .prepare(`SELECT * FROM supplier_payments WHERE purchase_order_id = ? ORDER BY paid_at ASC`)
      .bind(id)
      .all<SupplierPaymentRow>(),
  ]);

  const paidAmount = payments.results.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, po.total_amount - paidAmount);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Đơn mua {po.po_code}</h1>
          <div className="text-sm text-stone-500">
            {supplier?.name} ({supplier?.code}) · {formatDateTime(po.created_at)}
          </div>
        </div>
        <Badge variant={STATUS_BADGE[po.status]}>{STATUS_LABEL[po.status]}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Danh sách hàng mua</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                  <th className="p-3">SKU</th>
                  <th className="p-3">Sản phẩm</th>
                  <th className="p-3">SL</th>
                  <th className="p-3">Đơn giá</th>
                  <th className="p-3">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {items.results.map((it) => (
                  <tr key={it.id} className="border-b border-stone-100">
                    <td className="p-3 font-mono text-xs">{it.sku}</td>
                    <td className="p-3">{it.product_name}</td>
                    <td className="p-3">{it.quantity}</td>
                    <td className="p-3">{formatVnd(it.unit_cost)}</td>
                    <td className="p-3 font-medium">{formatVnd(it.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Công nợ</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">Tổng tiền</span>
              <span className="font-medium">{formatVnd(po.total_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Đã trả</span>
              <span>{formatVnd(paidAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-stone-100 pt-2 text-base font-bold text-red-600">
              <span>Còn nợ</span>
              <span>{formatVnd(remaining)}</span>
            </div>
            {po.status === "CONFIRMED" && remaining > 0 && (
              <div className="pt-2">
                <SupplierPaymentDialog purchaseOrderId={po.id} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lịch sử thanh toán</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {payments.results.length === 0 && <div className="text-stone-500">Chưa có thanh toán nào</div>}
            {payments.results.map((p) => (
              <div key={p.id} className="flex justify-between border-b border-stone-100 pb-1">
                <span className="text-stone-500">{formatDateTime(p.paid_at)}</span>
                <span className="font-medium">{formatVnd(p.amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {po.note && (
        <Card>
          <CardContent className="py-3 text-sm text-stone-500">Ghi chú: {po.note}</CardContent>
        </Card>
      )}

      {po.status === "DRAFT" && (
        <div className="flex justify-end">
          <PurchaseOrderActions id={po.id} totalAmount={po.total_amount} />
        </div>
      )}
    </div>
  );
}
