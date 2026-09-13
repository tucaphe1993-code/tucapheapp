"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AssignTaskDialog } from "@/components/orders/assign-task-dialog";
import { PrintProtocolButton } from "@/components/orders/print-protocol-button";
import { PackageCheck, Ban, CheckCircle2, Printer, ShieldCheck } from "lucide-react";
import { EQUIPMENT_DELIVERY_METHODS } from "@/lib/constants";
import type { OrderRow } from "@/types/db";

// Đơn "Khách tự lắp" không cần giao việc đóng gói cho nhân viên — khách tự
// đến lấy hàng, nên cho xuất kho thẳng (khớp với issueInventoryForOrder
// cho phép xuất kho từ CONFIRMED khi đơn dùng hình thức giao này).
const SELF_PICKUP_METHOD = EQUIPMENT_DELIVERY_METHODS[0];

export function OrderActions({
  order,
  hasActiveTask,
  hasDeviceItems,
  hasWarrantyItems,
  protocolId,
}: {
  order: OrderRow;
  hasActiveTask: boolean;
  hasDeviceItems: boolean;
  hasWarrantyItems: boolean;
  protocolId: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isSelfPickup = order.delivery_method === SELF_PICKUP_METHOD;

  async function call(path: string, successMsg: string) {
    setLoading(true);
    try {
      const res = await fetch(path, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Có lỗi xảy ra");
        return;
      }
      toast.success(successMsg);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasDeviceItems && <PrintProtocolButton orderId={order.id} existingProtocolId={protocolId} />}

      <Link href={`/orders/${order.id}/print`} target="_blank" rel="noopener noreferrer">
        <Button size="sm" variant="outline">
          <Printer className="h-4 w-4" /> In phiếu bán hàng
        </Button>
      </Link>

      {hasWarrantyItems && (
        <Link href={`/orders/${order.id}/print-warranty`} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline">
            <ShieldCheck className="h-4 w-4" /> In phiếu bảo hành
          </Button>
        </Link>
      )}

      {order.status === "CONFIRMED" && !hasActiveTask && !isSelfPickup && (
        <AssignTaskDialog orderId={order.id} />
      )}

      {(order.status === "PACKED" || (order.status === "CONFIRMED" && isSelfPickup)) && (
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm">
              <PackageCheck className="h-4 w-4" /> Xuất kho
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Xác nhận xuất kho</DialogTitle>
              <DialogDescription>
                Đơn hàng này sẽ được trừ tồn kho và chuyển sang trạng thái ĐÃ GIAO. Thao tác này
                chỉ thực hiện được một lần.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                disabled={loading}
                onClick={() => call(`/api/orders/${order.id}/ship`, "Đã xuất kho")}
              >
                Xác nhận xuất kho
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {order.status === "SHIPPED" && (
        <Button
          size="sm"
          disabled={loading}
          onClick={() => call(`/api/orders/${order.id}/complete`, "Đã hoàn thành đơn")}
        >
          <CheckCircle2 className="h-4 w-4" /> Hoàn thành đơn
        </Button>
      )}

      {["DRAFT", "CONFIRMED", "PACKING", "PACKED"].includes(order.status) && (
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="destructive">
              <Ban className="h-4 w-4" /> Hủy đơn
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Hủy đơn hàng</DialogTitle>
              <DialogDescription>
                Đơn hàng này và các công việc liên quan sẽ bị hủy. Không thể hoàn tác.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="destructive"
                disabled={loading}
                onClick={() => call(`/api/orders/${order.id}/cancel`, "Đã hủy đơn")}
              >
                Xác nhận hủy đơn
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
