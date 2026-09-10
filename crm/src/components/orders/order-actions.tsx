"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { PackageCheck, Ban, CheckCircle2 } from "lucide-react";
import type { OrderRow } from "@/types/db";

export function OrderActions({ order, hasActiveTask }: { order: OrderRow; hasActiveTask: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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
      {order.status === "CONFIRMED" && !hasActiveTask && <AssignTaskDialog orderId={order.id} />}

      {order.status === "PACKED" && (
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
                Đơn {order.order_code} sẽ được trừ tồn kho và chuyển sang trạng thái ĐÃ GIAO. Thao tác này
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
                Đơn {order.order_code} và các công việc liên quan sẽ bị hủy. Không thể hoàn tác.
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
