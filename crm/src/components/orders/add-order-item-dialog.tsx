"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AddOrderItemDialog({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") || "").trim(),
      unitPrice: Number(form.get("unitPrice") || 0),
      quantity: Number(form.get("quantity") || 1),
    };
    try {
      const res = await fetch(`/api/orders/${orderId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Thêm sản phẩm thất bại");
        return;
      }
      toast.success("Đã thêm sản phẩm vào đơn hàng");
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusCircle className="h-4 w-4" /> Thêm sản phẩm
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm sản phẩm vào đơn hàng</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Tên sản phẩm *</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantity">Số lượng *</Label>
              <Input id="quantity" name="quantity" type="number" min={1} defaultValue={1} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unitPrice">Đơn giá (đ)</Label>
              <Input id="unitPrice" name="unitPrice" type="number" min={0} defaultValue={0} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Đang lưu..." : "Thêm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
