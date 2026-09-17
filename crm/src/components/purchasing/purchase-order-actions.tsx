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
import { CheckCircle2, Trash2, XCircle } from "lucide-react";

export function PurchaseOrderActions({ id, totalAmount }: { id: string; totalAmount: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function call(path: string, method: string, successMsg: string, redirectAfter?: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/purchase-orders/${id}${path}`, { method });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Có lỗi xảy ra");
        return;
      }
      toast.success(successMsg);
      if (redirectAfter) router.push(redirectAfter);
      else router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={loading}>
            <Trash2 className="h-4 w-4" /> Xóa nháp
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa đơn mua nháp</DialogTitle>
            <DialogDescription>Bản nháp chưa xác nhận này sẽ bị xóa hẳn. Không thể hoàn tác.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" disabled={loading} onClick={() => call("", "DELETE", "Đã xóa nháp", "/purchasing")}>
              Xác nhận xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={loading}>
            <XCircle className="h-4 w-4" /> Hủy đơn
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hủy đơn mua</DialogTitle>
            <DialogDescription>Đơn mua sẽ chuyển sang trạng thái Hủy, không thể hoàn tác.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" disabled={loading} onClick={() => call("/cancel", "POST", "Đã hủy đơn mua")}>
              Xác nhận hủy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog>
        <DialogTrigger asChild>
          <Button size="sm" disabled={loading}>
            <CheckCircle2 className="h-4 w-4" /> Xác nhận đơn mua
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận đơn mua</DialogTitle>
            <DialogDescription>
              Hệ thống sẽ nhập kho toàn bộ các dòng hàng và ghi nhận công nợ {totalAmount.toLocaleString("vi-VN")}đ phải
              trả nhà cung cấp. Thao tác này chỉ thực hiện được một lần và không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button disabled={loading} onClick={() => call("/confirm", "POST", "Đã xác nhận đơn mua — đã nhập kho")}>
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
