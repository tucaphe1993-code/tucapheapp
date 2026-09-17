"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Trash2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SupplierFormDialog } from "@/components/suppliers/supplier-form-dialog";
import { formatVnd } from "@/lib/utils";
import type { PaymentMethodRow, ProductRow, ProductVariantRow, SupplierRow } from "@/types/db";

type ProductWithVariants = ProductRow & { variants: ProductVariantRow[] };

interface CartLine {
  variantId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitCost: number;
}

export function PurchaseOrderBuilder() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierResults, setSupplierResults] = useState<SupplierRow[]>([]);
  const [supplier, setSupplier] = useState<SupplierRow | null>(null);

  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState<number | "">(1);
  const [unitCost, setUnitCost] = useState<number | "">("");
  const [cart, setCart] = useState<CartLine[]>([]);

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [paymentMethodCode, setPaymentMethodCode] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []));
    fetch("/api/payment-methods")
      .then((r) => r.json())
      .then((d) => setPaymentMethods(d.paymentMethods ?? []));
  }, []);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!supplierQuery) return setSupplierResults([]);
      const res = await fetch(`/api/suppliers?q=${encodeURIComponent(supplierQuery)}`);
      if (res.ok) setSupplierResults((await res.json()).suppliers);
    }, 250);
    return () => clearTimeout(handle);
  }, [supplierQuery]);

  const allVariants = products.flatMap((p) => p.variants.map((v) => ({ ...v, productName: p.name })));
  const selectedVariant = allVariants.find((v) => v.id === variantId);

  function onSelectVariant(id: string) {
    setVariantId(id);
    const v = allVariants.find((x) => x.id === id);
    if (v) setUnitCost(v.cost_price || "");
  }

  function addToCart() {
    if (!selectedVariant) return toast.error("Vui lòng chọn hàng hóa");
    if (!qty || qty <= 0) return toast.error("Số lượng phải lớn hơn 0");
    if (unitCost === "" || unitCost < 0) return toast.error("Vui lòng nhập đơn giá mua");
    setCart((cur) => {
      const existing = cur.find((l) => l.variantId === selectedVariant.id);
      if (existing) {
        return cur.map((l) =>
          l.variantId === selectedVariant.id ? { ...l, quantity: l.quantity + Number(qty) } : l
        );
      }
      return [
        ...cur,
        {
          variantId: selectedVariant.id,
          sku: selectedVariant.sku,
          productName: selectedVariant.productName,
          quantity: Number(qty),
          unitCost: Number(unitCost),
        },
      ];
    });
    setQty(1);
    setUnitCost("");
  }

  function removeLine(variantId: string) {
    setCart((cur) => cur.filter((l) => l.variantId !== variantId));
  }

  const total = cart.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);

  async function onSubmit() {
    if (!supplier) return toast.error("Vui lòng chọn nhà cung cấp");
    if (cart.length === 0) return toast.error("Vui lòng thêm ít nhất 1 mặt hàng");

    setSubmitting(true);
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: supplier.id,
          paymentMethodCode: paymentMethodCode || undefined,
          note: note || undefined,
          items: cart.map((l) => ({ productVariantId: l.variantId, quantity: l.quantity, unitCost: l.unitCost })),
        }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Tạo đơn mua thất bại");
      toast.success(`Đã tạo đơn mua nháp ${data.purchaseOrder.po_code}`);
      router.push(`/purchasing/${data.purchaseOrder.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Chọn nhà cung cấp</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {supplier ? (
              <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 p-3">
                <div>
                  <div className="font-medium">
                    {supplier.name} <span className="text-stone-400 font-normal">({supplier.code})</span>
                  </div>
                  <div className="text-sm text-stone-500">{supplier.phone}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSupplier(null)}>
                  Đổi
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <Input
                    className="pl-9"
                    placeholder="Tìm nhà cung cấp theo tên/SĐT..."
                    value={supplierQuery}
                    onChange={(e) => setSupplierQuery(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  {supplierResults.map((s) => (
                    <button
                      key={s.id}
                      className="rounded-lg border border-stone-200 p-2 text-left text-sm hover:border-amber-300"
                      onClick={() => setSupplier(s)}
                    >
                      <div className="font-medium">
                        {s.name} <span className="text-stone-400 font-normal">({s.code})</span>
                      </div>
                      <div className="text-stone-500">{s.phone}</div>
                    </button>
                  ))}
                </div>
                <SupplierFormDialog trigger={<Button variant="outline" size="sm">+ Nhà cung cấp mới</Button>} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Chọn hàng hóa</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="variantId">Hàng hóa</Label>
              <Select id="variantId" value={variantId} onChange={(e) => onSelectVariant(e.target.value)}>
                <option value="">-- Chọn hàng hóa --</option>
                {allVariants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.sku} — {v.productName}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="qty">Số lượng</Label>
                <Input
                  id="qty"
                  type="number"
                  step="0.01"
                  min={0.01}
                  value={qty}
                  onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="unitCost">Đơn giá mua (đ)</Label>
                <Input
                  id="unitCost"
                  type="number"
                  min={0}
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
            </div>
            <Button type="button" variant="outline" onClick={addToCart} className="w-fit">
              <PlusCircle className="h-4 w-4" /> Thêm vào đơn
            </Button>
          </CardContent>
        </Card>

        {cart.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Danh sách hàng mua</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-left text-stone-500">
                      <th className="p-3">SKU</th>
                      <th className="p-3">Sản phẩm</th>
                      <th className="p-3">SL</th>
                      <th className="p-3">Đơn giá</th>
                      <th className="p-3">Thành tiền</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((l) => (
                      <tr key={l.variantId} className="border-b border-stone-100">
                        <td className="p-3 font-mono text-xs">{l.sku}</td>
                        <td className="p-3">{l.productName}</td>
                        <td className="p-3">{l.quantity}</td>
                        <td className="p-3">{formatVnd(l.unitCost)}</td>
                        <td className="p-3 font-medium">{formatVnd(l.quantity * l.unitCost)}</td>
                        <td className="p-3">
                          <button onClick={() => removeLine(l.variantId)} aria-label="Xóa">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thông tin đơn mua</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paymentMethodCode">Phương thức thanh toán</Label>
              <Select id="paymentMethodCode" value={paymentMethodCode} onChange={(e) => setPaymentMethodCode(e.target.value)}>
                <option value="">-- Chọn --</option>
                {paymentMethods.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="note">Ghi chú</Label>
              <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="flex justify-between border-t border-stone-100 pt-3 text-base font-bold text-amber-800">
              <span>Tổng tiền</span>
              <span>{formatVnd(total)}</span>
            </div>
            <Button onClick={onSubmit} disabled={submitting}>
              {submitting ? "Đang tạo..." : "Tạo đơn mua (nháp)"}
            </Button>
            <p className="text-xs text-stone-400">
              Đơn tạo ra là bản NHÁP — chưa nhập kho, chưa phát sinh công nợ. Vào chi tiết đơn để xác nhận.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
