"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowDownToLine, SlidersHorizontal } from "lucide-react";

export function ReceiveInventoryDialog({ productVariantId, sku }: { productVariantId: string; sku: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/inventory/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productVariantId,
          quantity: Number(form.get("quantity")),
          note: String(form.get("note") || ""),
        }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error);
      toast.success(`Đã nhập kho ${sku}`);
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ArrowDownToLine className="h-4 w-4" /> Nhập kho
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nhập kho — {sku}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Số lượng nhập *</Label>
            <Input name="quantity" type="number" min={1} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Ghi chú</Label>
            <Textarea name="note" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Đang lưu..." : "Xác nhận nhập kho"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdjustInventoryDialog({ productVariantId, sku }: { productVariantId: string; sku: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productVariantId,
          delta: Number(form.get("delta")),
          note: String(form.get("note") || ""),
        }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error);
      toast.success(`Đã điều chỉnh tồn kho ${sku}`);
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <SlidersHorizontal className="h-4 w-4" /> Điều chỉnh
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Điều chỉnh tồn kho — {sku}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Số lượng thay đổi (+/-) *</Label>
            <Input name="delta" type="number" required placeholder="VD: -5 hoặc 10" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Lý do điều chỉnh *</Label>
            <Textarea name="note" required placeholder="VD: Kiểm kê phát hiện lệch, hàng hỏng..." />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Đang lưu..." : "Xác nhận điều chỉnh"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
