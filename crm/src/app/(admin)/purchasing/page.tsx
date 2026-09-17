import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatVnd } from "@/lib/utils";
import { PlusCircle } from "lucide-react";
import type { PurchaseOrderRow, PurchaseOrderStatus } from "@/types/db";

interface PurchaseOrderListRow extends PurchaseOrderRow {
  supplier_name: string;
  paid_amount: number;
}

const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Nháp",
  CONFIRMED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};
const STATUS_BADGE: Record<PurchaseOrderStatus, "success" | "warning" | "secondary"> = {
  DRAFT: "warning",
  CONFIRMED: "success",
  CANCELLED: "secondary",
};

export default async function PurchasingPage() {
  const db = getDb();
  const { results } = await db
    .prepare(
      `SELECT po.*, s.name as supplier_name,
              COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE purchase_order_id = po.id), 0) as paid_amount
       FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
       ORDER BY po.created_at DESC LIMIT 200`
    )
    .all<PurchaseOrderListRow>();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-stone-900">Mua hàng</h1>
        <Link href="/purchasing/new">
          <Button size="sm">
            <PlusCircle className="h-4 w-4" /> Tạo đơn mua
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                  <th className="p-3">Số CT</th>
                  <th className="p-3">Ngày</th>
                  <th className="p-3">Nhà cung cấp</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3">Tổng tiền</th>
                  <th className="p-3">Đã chi</th>
                  <th className="p-3">Còn nợ</th>
                </tr>
              </thead>
              <tbody>
                {results.map((po) => (
                  <tr key={po.id} className="border-b border-stone-100">
                    <td className="p-3">
                      <Link href={`/purchasing/${po.id}`} className="font-medium text-amber-800 hover:underline">
                        {po.po_code}
                      </Link>
                    </td>
                    <td className="p-3 text-stone-500">{formatDateTime(po.created_at)}</td>
                    <td className="p-3">{po.supplier_name}</td>
                    <td className="p-3">
                      <Badge variant={STATUS_BADGE[po.status]}>{STATUS_LABEL[po.status]}</Badge>
                    </td>
                    <td className="p-3 font-medium">{formatVnd(po.total_amount)}</td>
                    <td className="p-3">{formatVnd(po.paid_amount)}</td>
                    <td className="p-3 text-red-600">{formatVnd(Math.max(0, po.total_amount - po.paid_amount))}</td>
                  </tr>
                ))}
                {results.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-stone-500">
                      Chưa có đơn mua nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
