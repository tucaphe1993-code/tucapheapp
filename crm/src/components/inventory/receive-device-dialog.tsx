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
import { ArrowDownToLine } from "lucide-react";

export function ReceiveDeviceDialog({
  productId,
  variantId,
  sku,
}: {
  productId: string;
  variantId: string;
  sku: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const serials = String(form.get("serials") || "")
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const res = await fetch(`/api/products/${productId}/variants/${variantId}/devices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serials,
          supplier: String(form.get("supplier") || "") || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error);
      toast.success(`Đã nhập kho ${serials.length} thiết bị`);
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
          <ArrowDownToLine className="h-4 w-4" /> Nhập kho theo Serial
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nhập kho — {sku}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Danh sách Serial * (mỗi dòng 1 Serial)</Label>
            <Textarea name="serials" required rows={5} placeholder={"LM001\nLM002\nLM003"} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Nhà cung cấp</Label>
            <Input name="supplier" />
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
