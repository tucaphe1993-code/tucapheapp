"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PlusCircle } from "lucide-react";

export function VariantFormDialog({ productId }: { productId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      form: String(form.get("form")),
      packaging: String(form.get("packaging")),
      weightGrams: Number(form.get("weightGrams")),
      unitPrice: Number(form.get("unitPrice")),
      costPrice: Number(form.get("costPrice") || 0),
      lowStockThreshold: Number(form.get("lowStockThreshold") || 10),
    };
    try {
      const res = await fetch(`/api/products/${productId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Có lỗi xảy ra");
        return;
      }
      toast.success(`Đã tạo SKU ${data.variant.sku}`);
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
          <PlusCircle className="h-4 w-4" /> Thêm biến thể
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm biến thể / SKU</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="form">Hình thức</Label>
              <Select id="form" name="form" required defaultValue="HAT">
                <option value="HAT">Hạt</option>
                <option value="BOT">Bột</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="packaging">Bao bì</Label>
              <Select id="packaging" name="packaging" required defaultValue="TUI_XANH">
                <option value="TUI_XANH">Túi Xanh</option>
                <option value="TUI_ZIP">Túi Zip</option>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="weightGrams">Quy cách (gram)</Label>
            <Select id="weightGrams" name="weightGrams" required defaultValue="500">
              <option value="250">250g</option>
              <option value="500">500g</option>
              <option value="1000">1kg</option>
              <option value="2000">2kg</option>
              <option value="5000">5kg</option>
              <option value="10000">10kg</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unitPrice">Đơn giá bán (đ) *</Label>
              <Input id="unitPrice" name="unitPrice" type="number" min={0} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="costPrice">Giá vốn (đ)</Label>
              <Input id="costPrice" name="costPrice" type="number" min={0} defaultValue={0} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lowStockThreshold">Ngưỡng cảnh báo sắp hết</Label>
            <Input
              id="lowStockThreshold"
              name="lowStockThreshold"
              type="number"
              min={0}
              defaultValue={10}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
