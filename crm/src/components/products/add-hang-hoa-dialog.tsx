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
import { formatVnd } from "@/lib/utils";
import { PRODUCT_CATEGORY_OPTIONS } from "@/lib/constants";
import type { UnitRow } from "@/types/db";

// Nhóm hàng "Cà Phê" bắt buộc phải chọn đủ Hình thức/Bao bì/Quy cách thì
// SKU tạo ra mới chọn được ở cascade "Tạo đơn cà phê" (§ /orders/new) —
// khớp đúng luồng của tab "Theo dòng sản phẩm".
const COFFEE_CATEGORY = "Cà Phê";

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
  const [costBeforeVat, setCostBeforeVat] = useState<number | "">(0);
  const [costVatPercent, setCostVatPercent] = useState<number | "">(8);
  const [priceBeforeVat, setPriceBeforeVat] = useState<number | "">(0);
  const [vatPercent, setVatPercent] = useState<number | "">(8);
  const [category, setCategory] = useState("");
  const isCoffee = category === COFFEE_CATEGORY;

  useEffect(() => {
    if (!open) return;
    fetch("/api/units")
      .then((r) => r.json())
      .then((d) => setUnits(d.units ?? []));
  }, [open]);

  const costAfterVat = Math.round((Number(costBeforeVat) || 0) * (1 + (Number(costVatPercent) || 0) / 100));
  const priceAfterVat = Math.round((Number(priceBeforeVat) || 0) * (1 + (Number(vatPercent) || 0) / 100));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      sku: String(form.get("sku") || ""),
      productName: String(form.get("productName") || ""),
      category: String(form.get("category") || ""),
      unit: String(form.get("unit") || ""),
      unitPrice: priceAfterVat,
      costPrice: costAfterVat,
      lowStockThreshold: Number(form.get("lowStockThreshold") || 0),
      isActive: form.get("isActive") === "1",
      note: String(form.get("note") || ""),
      ...(isCoffee
        ? {
            form: String(form.get("form")),
            packaging: String(form.get("packaging")),
            weightGrams: Number(form.get("weightGrams")),
          }
        : {}),
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
      setCostBeforeVat(0);
      setCostVatPercent(8);
      setPriceBeforeVat(0);
      setVatPercent(8);
      setCategory("");
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
              <Label htmlFor="sku">{isCoffee ? "Mã dòng cà phê *" : "Mã hàng *"}</Label>
              <Input
                id="sku"
                name="sku"
                required
                className="font-mono"
                placeholder={isCoffee ? "VD: CBRANG (SKU tự sinh theo hình thức/bao bì/quy cách)" : "VD: HH020"}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="productName">Tên hàng *</Label>
              <Input id="productName" name="productName" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Nhóm hàng</Label>
              <Select
                id="category"
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">-- Chọn --</option>
                {PRODUCT_CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unit">ĐVT</Label>
              <Select id="unit" name="unit" defaultValue={isCoffee ? "Túi" : "Cái"} key={isCoffee ? "coffee" : "other"}>
                {units.map((u) => (
                  <option key={u.code} value={u.name}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {isCoffee && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="form">Hình thức *</Label>
                  <Select id="form" name="form" required defaultValue="HAT">
                    <option value="HAT">Hạt</option>
                    <option value="BOT">Bột</option>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="packaging">Bao bì *</Label>
                  <Select id="packaging" name="packaging" required defaultValue="TUI_XANH">
                    <option value="TUI_XANH">Túi Xanh</option>
                    <option value="TUI_ZIP">Túi Zip</option>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="weightGrams">Quy cách (gram) *</Label>
                <Select id="weightGrams" name="weightGrams" required defaultValue="500">
                  <option value="250">250g</option>
                  <option value="500">500g</option>
                  <option value="1000">1kg</option>
                  <option value="2000">2kg</option>
                  <option value="5000">5kg</option>
                  <option value="10000">10kg</option>
                </Select>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="costBeforeVat">Giá nhập chưa VAT (đ)</Label>
              <Input
                id="costBeforeVat"
                type="number"
                min={0}
                value={costBeforeVat}
                onChange={(e) => setCostBeforeVat(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="costVatPercent">VAT nhập (%)</Label>
              <Input
                id="costVatPercent"
                type="number"
                min={0}
                max={100}
                value={costVatPercent}
                onChange={(e) => setCostVatPercent(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
          </div>
          <div className="rounded-lg bg-stone-50 p-2.5 text-sm">
            <span className="text-stone-500">Giá nhập sau VAT (lưu làm giá vốn): </span>
            <span className="font-semibold text-stone-700">{formatVnd(costAfterVat)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="priceBeforeVat">Giá bán chưa VAT (đ) *</Label>
              <Input
                id="priceBeforeVat"
                type="number"
                min={0}
                required
                value={priceBeforeVat}
                onChange={(e) => setPriceBeforeVat(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vatPercent">VAT bán (%)</Label>
              <Input
                id="vatPercent"
                type="number"
                min={0}
                max={100}
                value={vatPercent}
                onChange={(e) => setVatPercent(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
          </div>
          <div className="rounded-lg bg-stone-50 p-2.5 text-sm">
            <span className="text-stone-500">Giá bán sau VAT (lưu làm giá bán): </span>
            <span className="font-semibold text-amber-800">{formatVnd(priceAfterVat)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lowStockThreshold">Tồn tối thiểu</Label>
              <Input id="lowStockThreshold" name="lowStockThreshold" type="number" min={0} defaultValue={10} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="isActive">Trạng thái</Label>
              <Select id="isActive" name="isActive" defaultValue="1">
                <option value="1">Hoạt động</option>
                <option value="0">Ngừng hoạt động</option>
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
