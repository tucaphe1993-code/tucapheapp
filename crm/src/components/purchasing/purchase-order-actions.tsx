"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface PurchaseOrderLineForConfirm {
  id: string;
  sku: string;
  productName: string;
  quantity: number;
  requiresSerial: number;
}

export function PurchaseOrderActions({
  id,
  totalAmount,
  items,
}: {
  id: string;
  totalAmount: number;
  items: PurchaseOrderLineForConfirm[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const serialItems = items.filter((it) => it.requiresSerial);
  const [serialInputs, setSerialInputs] = useState<Record<string, string>>({});

  async function call(path: string, method: string, successMsg: string, options?: { body?: unknown; redirectAfter?: string }) {
    setLoading(true);
    try {
      const res = await fetch(`/api/purchase-orders/${id}${path}`, {
        method,
        headers: options?.body ? { "Content-Type": "application/json" } : undefined,
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Có lỗi xảy ra");
        return;
      }
      toast.success(successMsg);
      if (options?.redirectAfter) router.push(options.redirectAfter);
      else router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function onConfirm() {
    const serials: Record<string, string[]> = {};
    for (const it of serialItems) {
      const list = (serialInputs[it.id] ?? "")
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (list.length !== it.quantity) {
        toast.error(`SKU ${it.sku}: cần nhập đúng ${it.quantity} số Serial (đã nhập ${list.length})`);
        return;
      }
      serials[it.id] = list;
    }
    call("/confirm", "POST", "Đã xác nhận đơn mua — đã nhập kho", { body: { serials } });
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
            <Button
              variant="destructive"
              disabled={loading}
              onClick={() => call("", "DELETE", "Đã xóa nháp", { redirectAfter: "/purchasing" })}
            >
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
          {serialItems.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-stone-100 pt-3">
              <p className="text-xs text-stone-500">
                Các SKU dưới đây quản lý theo Serial — nhập đủ số Serial (mỗi dòng 1 số, hoặc cách nhau bằng dấu phẩy)
                thì hệ thống mới tạo được thiết bị trong kho.
              </p>
              {serialItems.map((it) => (
                <div key={it.id} className="flex flex-col gap-1.5">
                  <Label htmlFor={`serial-${it.id}`}>
                    {it.sku} — {it.productName} (cần {it.quantity} Serial)
                  </Label>
                  <Textarea
                    id={`serial-${it.id}`}
                    placeholder={`Nhập ${it.quantity} số Serial, mỗi dòng 1 số`}
                    value={serialInputs[it.id] ?? ""}
                    onChange={(e) => setSerialInputs((cur) => ({ ...cur, [it.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button disabled={loading} onClick={onConfirm}>
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
