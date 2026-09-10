"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Trash2, PlusCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { formatVnd } from "@/lib/utils";
import { DELIVERY_METHODS } from "@/lib/constants";
import type { CustomerRow, ProductRow, ProductVariantRow } from "@/types/db";

type ProductWithVariants = ProductRow & { variants: ProductVariantRow[] };

interface CartLine {
  variant: ProductVariantRow;
  productName: string;
  quantity: number;
}

const FORM_LABEL: Record<string, string> = { HAT: "Hạt", BOT: "Bột" };
const PACKAGING_LABEL: Record<string, string> = { TUI_XANH: "Túi Xanh", TUI_ZIP: "Túi Zip" };

export function OrderBuilder() {
  const router = useRouter();

  // customer picker
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerRow[]>([]);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [customerPrices, setCustomerPrices] = useState<Record<string, number>>({});

  // product picker
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [productId, setProductId] = useState("");
  const [form, setForm] = useState("HAT");
  const [packaging, setPackaging] = useState("TUI_XANH");
  const [weight, setWeight] = useState<number | "">("");
  const [qty, setQty] = useState(1);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []));
  }, []);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!customerQuery) return setCustomerResults([]);
      const res = await fetch(`/api/customers?q=${encodeURIComponent(customerQuery)}`);
      if (res.ok) setCustomerResults((await res.json()).customers);
    }, 250);
    return () => clearTimeout(handle);
  }, [customerQuery]);

  useEffect(() => {
    if (!customer) return;
    fetch(`/api/customers/${customer.id}/prices`)
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, number> = {};
        for (const p of d.prices ?? []) map[p.product_variant_id] = p.unit_price;
        setCustomerPrices(map);
      });
  }, [customer]);

  function priceFor(variant: ProductVariantRow) {
    if (!customer) return variant.unit_price;
    return customerPrices[variant.id] ?? variant.unit_price;
  }

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

  function addToCart() {
    if (!selectedProduct || !matchedVariant) {
      toast.error("Vui lòng chọn đầy đủ hình thức / bao bì / quy cách");
      return;
    }
    if (qty <= 0) {
      toast.error("Số lượng phải lớn hơn 0");
      return;
    }
    setCart((cur) => {
      const existing = cur.find((l) => l.variant.id === matchedVariant.id);
      if (existing) {
        return cur.map((l) =>
          l.variant.id === matchedVariant.id ? { ...l, quantity: l.quantity + qty } : l
        );
      }
      return [...cur, { variant: matchedVariant, productName: selectedProduct.name, quantity: qty }];
    });
    setQty(1);
  }

  function removeLine(variantId: string) {
    setCart((cur) => cur.filter((l) => l.variant.id !== variantId));
  }

  const total = cart.reduce((sum, l) => sum + priceFor(l.variant) * l.quantity, 0);

  async function onSubmit() {
    if (!customer) return toast.error("Vui lòng chọn khách hàng");
    if (cart.length === 0) return toast.error("Vui lòng thêm ít nhất 1 sản phẩm");

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          deliveryDate: deliveryDate || undefined,
          deliveryMethod: deliveryMethod || undefined,
          note: note || undefined,
          items: cart.map((l) => ({ productVariantId: l.variant.id, quantity: l.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Tạo đơn thất bại");
      toast.success("Đã tạo đơn hàng thành công");
      router.push(`/orders/${data.order.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Chọn khách hàng</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {customer ? (
              <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 p-3">
                <div>
                  <div className="font-medium">{customer.name}</div>
                  <div className="text-sm text-stone-500">{customer.phone}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setCustomer(null)}>
                  Đổi
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <Input
                    className="pl-9"
                    placeholder="Tìm khách hàng theo tên/SĐT..."
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  {customerResults.map((c) => (
                    <button
                      key={c.id}
                      className="rounded-lg border border-stone-200 p-2 text-left text-sm hover:border-amber-300"
                      onClick={() => setCustomer(c)}
                    >
                      <div className="font-medium">{c.name}</div>
                      <div className="text-stone-500">{c.phone}</div>
                    </button>
                  ))}
                </div>
                <CustomerFormDialog trigger={<Button variant="outline" size="sm">+ Khách hàng mới</Button>} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Chọn sản phẩm</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
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
              <div className="rounded-lg bg-stone-50 p-2 text-sm font-medium">
                {formatVnd(priceFor(matchedVariant))}
                {customerPrices[matchedVariant.id] !== undefined && (
                  <span className="ml-2 text-xs font-normal text-amber-700">(giá riêng khách hàng)</span>
                )}
              </div>
            )}
            <div className="flex items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Số lượng</Label>
                <Input
                  type="number"
                  min={1}
                  className="w-24"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                />
              </div>
              <Button onClick={addToCart} disabled={!matchedVariant}>
                <PlusCircle className="h-4 w-4" /> Thêm sản phẩm
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Thông tin giao hàng</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Ngày giao</Label>
              <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Cách thức giao hàng</Label>
              <Select value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value)}>
                <option value="">-- Chọn cách thức giao hàng --</option>
                {DELIVERY_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Ghi chú</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card className="lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle className="text-base">Giỏ hàng ({cart.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {cart.length === 0 && <p className="text-sm text-stone-400">Chưa có sản phẩm</p>}
            {cart.map((l) => (
              <div key={l.variant.id} className="flex items-center justify-between border-b border-stone-100 pb-2 text-sm">
                <div>
                  <div className="font-medium">{l.productName}</div>
                  <div className="text-stone-500">
                    {FORM_LABEL[l.variant.form]} · {PACKAGING_LABEL[l.variant.packaging]} ·{" "}
                    {l.variant.weight_grams >= 1000
                      ? `${l.variant.weight_grams / 1000}kg`
                      : `${l.variant.weight_grams}g`}{" "}
                    x{l.quantity}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatVnd(priceFor(l.variant) * l.quantity)}</span>
                  <button onClick={() => removeLine(l.variant.id)} className="text-stone-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 font-semibold">
              <span>Tổng cộng</span>
              <span>{formatVnd(total)}</span>
            </div>
            <Button size="lg" onClick={onSubmit} disabled={submitting} className="mt-2 w-full">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Tạo đơn
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
