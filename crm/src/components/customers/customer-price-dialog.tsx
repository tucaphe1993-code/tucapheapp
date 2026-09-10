"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusCircle } from "lucide-react";
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
import { formatVnd } from "@/lib/utils";
import type { ProductRow, ProductVariantRow } from "@/types/db";

type ProductWithVariants = ProductRow & { variants: ProductVariantRow[] };

export function CustomerPriceDialog({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [productId, setProductId] = useState("");
  const [form, setForm] = useState("HAT");
  const [packaging, setPackaging] = useState("TUI_XANH");
  const [weight, setWeight] = useState<number | "">("");
  const [price, setPrice] = useState<number | "">("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []));
  }, [open]);

  const selectedProduct = products.find((p) => p.id === productId);
  const availableWeights = useMemo(() => {
    if (!selectedProduct) return [];
    return selectedProduct.variants
      .filter((v) => v.form === form && v.packaging === packaging && v.is_active)
      .map((v) => v.weight_grams)
      .sort((a, b) => a - b);
  }, [selectedProduct, form, packaging]);

  const matchedVariant = selectedProduct?.variants.find(
    (v) => v.form === form && v.packaging === packaging && v.weight_grams === weight
  );

  async function onSubmit() {
    if (!matchedVariant) return toast.error("Vui lòng chọn đầy đủ sản phẩm");
    if (price === "" || price < 0) return toast.error("Vui lòng nhập giá hợp lệ");

    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productVariantId: matchedVariant.id, unitPrice: price }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Có lỗi xảy ra");
      toast.success("Đã lưu giá riêng");
      setOpen(false);
      setProductId("");
      setWeight("");
      setPrice("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <PlusCircle className="h-4 w-4" /> Thêm giá riêng
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm giá riêng cho khách hàng</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Dòng cà phê</Label>
            <Select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setWeight("");
              }}
            >
              <option value="">-- Chọn dòng cà phê --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Hạt / Bột</Label>
              <Select
                value={form}
                onChange={(e) => {
                  setForm(e.target.value);
                  setWeight("");
                }}
              >
                <option value="HAT">Hạt</option>
                <option value="BOT">Bột</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Bao bì</Label>
              <Select
                value={packaging}
                onChange={(e) => {
                  setPackaging(e.target.value);
                  setWeight("");
                }}
              >
                <option value="TUI_XANH">Túi Xanh</option>
                <option value="TUI_ZIP">Túi Zip</option>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Quy cách</Label>
            <Select value={weight} onChange={(e) => setWeight(Number(e.target.value))}>
              <option value="">-- Chọn quy cách --</option>
              {availableWeights.map((w) => (
                <option key={w} value={w}>
                  {w >= 1000 ? `${w / 1000}kg` : `${w}g`}
                </option>
              ))}
            </Select>
          </div>
          {matchedVariant && (
            <div className="rounded-lg bg-stone-50 p-2 text-sm text-stone-500">
              Giá mặc định: {formatVnd(matchedVariant.unit_price)}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Giá riêng cho khách hàng này (đ) *</Label>
            <Input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={loading}>
            {loading ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
