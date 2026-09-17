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
import { Pencil } from "lucide-react";
import type { UnitRow } from "@/types/db";

export interface HangHoaItem {
  id: string;
  sku: string;
  productName: string;
  category: string | null;
  unit: string | null;
  barcode: string | null;
  unitPrice: number;
  costPrice: number;
  lowStockThreshold: number | null;
  isActive: number;
  note: string | null;
  requiresSerial: number;
}

// Modal "Sửa hàng hóa" dùng chung cho mọi loại (cà phê/máy/thiết bị) — Mã
// hàng/Tên hàng hóa cố định (đổi ở dòng sản phẩm), các thuộc tính danh mục
// (nhóm/ĐVT/barcode/giá/tồn tối thiểu/trạng thái/ghi chú) sửa tại đây.
export function VariantEditDialog({ item }: { item: HangHoaItem }) {
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
    const payload: Record<string, unknown> = {
      category: String(form.get("category") || ""),
      unit: String(form.get("unit") || ""),
      barcode: String(form.get("barcode") || ""),
      unitPrice: Number(form.get("unitPrice")),
      costPrice: Number(form.get("costPrice") || 0),
      isActive: form.get("isActive") === "1",
      note: String(form.get("note") || ""),
    };
    if (!item.requiresSerial) {
      payload.lowStockThreshold = Number(form.get("lowStockThreshold") || 0);
    }
    try {
      const res = await fetch(`/api/variants/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Có lỗi xảy ra");
        return;
      }
      toast.success(`Đã cập nhật ${item.sku}`);
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" /> Sửa
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa hàng hóa</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Mã hàng</Label>
              <Input value={item.sku} disabled className="font-mono" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Tên hàng hóa</Label>
              <Input value={item.productName} disabled />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Nhóm hàng</Label>
              <Input id="category" name="category" defaultValue={item.category ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unit">ĐVT</Label>
              <Select id="unit" name="unit" defaultValue={item.unit ?? ""}>
                {units.map((u) => (
                  <option key={u.code} value={u.name}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="barcode">Mã vạch (Barcode)</Label>
            <Input id="barcode" name="barcode" defaultValue={item.barcode ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unitPrice">Giá bán (đ) *</Label>
              <Input id="unitPrice" name="unitPrice" type="number" min={0} required defaultValue={item.unitPrice} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="costPrice">Giá vốn chuẩn (đ)</Label>
              <Input id="costPrice" name="costPrice" type="number" min={0} defaultValue={item.costPrice} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!item.requiresSerial && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lowStockThreshold">Tồn tối thiểu</Label>
                <Input
                  id="lowStockThreshold"
                  name="lowStockThreshold"
                  type="number"
                  min={0}
                  defaultValue={item.lowStockThreshold ?? 0}
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="isActive">Trạng thái</Label>
              <Select id="isActive" name="isActive" defaultValue={item.isActive ? "1" : "0"}>
                <option value="1">Đang bán</option>
                <option value="0">Ngừng bán</option>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Ghi chú</Label>
            <Textarea id="note" name="note" defaultValue={item.note ?? ""} />
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
