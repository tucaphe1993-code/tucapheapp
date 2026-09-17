"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PlusCircle } from "lucide-react";
import type { UnitRow } from "@/types/db";

// Modal "Thêm hàng hóa" — tạo nhanh 1 SKU giống ERP tham khảo, không cần
// biết khái niệm dòng sản phẩm/biến thể (hệ thống tự tạo dòng sản phẩm
// ẩn phía sau qua POST /api/variants). Không có mã vạch/nhóm-theo-loại —
// dùng cho hàng hóa/vật tư/phụ kiện đơn giản; cà phê đóng gói (cần hình
// thức/bao bì/quy cách) và máy/thiết bị quản lý Serial vẫn tạo qua tab
// "Theo dòng sản phẩm".
export function AddHangHoaDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<UnitRow[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/units")
      .then((r) => r.json())
      .then((d) => setUnits(d.units ?? []));
  }, [open]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      sku: String(form.get("sku") || ""),
      productName: String(form.get("productName") || ""),
      category: String(form.get("category") || ""),
      unit: String(form.get("unit") || ""),
      unitPrice: Number(form.get("unitPrice") || 0),
      costPrice: Number(form.get("costPrice") || 0),
      lowStockThreshold: Number(form.get("lowStockThreshold") || 0),
      isActive: form.get("isActive") === "1",
      note: String(form.get("note") || ""),
    };
    try {
      const res = await fetch("/api/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Có lỗi xảy ra");
        return;
      }
      toast.success(`Đã tạo hàng hóa ${data.variant.sku}`);
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusCircle className="h-4 w-4" /> Thêm hàng hóa
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm hàng hóa</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sku">Mã hàng *</Label>
              <Input id="sku" name="sku" required className="font-mono" placeholder="VD: HH020" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="productName">Tên hàng *</Label>
              <Input id="productName" name="productName" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Nhóm hàng</Label>
              <Input id="category" name="category" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unit">ĐVT</Label>
              <Select id="unit" name="unit" defaultValue="Cái">
                {units.map((u) => (
                  <option key={u.code} value={u.name}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unitPrice">Giá bán (đ) *</Label>
              <Input id="unitPrice" name="unitPrice" type="number" min={0} required defaultValue={0} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="costPrice">Giá vốn (đ)</Label>
              <Input id="costPrice" name="costPrice" type="number" min={0} defaultValue={0} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lowStockThreshold">Tồn tối thiểu</Label>
              <Input id="lowStockThreshold" name="lowStockThreshold" type="number" min={0} defaultValue={10} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="isActive">Trạng thái</Label>
              <Select id="isActive" name="isActive" defaultValue="1">
                <option value="1">Đang bán</option>
                <option value="0">Ngừng bán</option>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Ghi chú</Label>
            <Textarea id="note" name="note" />
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
