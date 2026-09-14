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
import { CheckCircle2, Trash2 } from "lucide-react";

export function RoastBatchActions({ batchId, inputKg }: { batchId: string; inputKg: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function confirm() {
    setLoading(true);
    try {
      const res = await fetch(`/api/roast-batches/${batchId}/confirm`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Có lỗi xảy ra");
        return;
      }
      toast.success("Đã xác nhận mẻ rang — đã trừ nhân xanh, cộng cà phê rang");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function deleteDraft() {
    setLoading(true);
    try {
      const res = await fetch(`/api/roast-batches/${batchId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Có lỗi xảy ra");
        return;
      }
      toast.success("Đã xóa bản nháp");
      router.push("/inventory/roasting");
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
            <DialogTitle>Xóa mẻ rang nháp</DialogTitle>
            <DialogDescription>Bản nháp chưa xác nhận này sẽ bị xóa hẳn. Không thể hoàn tác.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" disabled={loading} onClick={deleteDraft}>
              Xác nhận xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog>
        <DialogTrigger asChild>
          <Button size="sm" disabled={loading}>
            <CheckCircle2 className="h-4 w-4" /> Xác nhận mẻ rang
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận mẻ rang</DialogTitle>
            <DialogDescription>
              Hệ thống sẽ trừ {inputKg}kg nhân xanh và cộng cà phê rang thành phẩm vào tồn kho. Thao tác này chỉ thực
              hiện được một lần và không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button disabled={loading} onClick={confirm}>
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
