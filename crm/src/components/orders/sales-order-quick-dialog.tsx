"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusCircle, Trash2 } from "lucide-react";
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
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { formatVnd } from "@/lib/utils";
import { EQUIPMENT_PRODUCT_TYPES } from "@/lib/constants";
import type { CustomerRow, DeviceRow, PaymentMethodRow, ProductRow, ProductVariantRow } from "@/types/db";

type ProductWithVariants = ProductRow & { variants: ProductVariantRow[] };
type SellableVariant = ProductVariantRow & { productId: string; productName: string };

interface QuickLine {
  key: string;
  variantId: string;
  quantity: number;
  discountPercent: number;
  taxPercent: number;
  deviceId?: string;
  availableDevices: DeviceRow[];
}

function emptyLine(): QuickLine {
  return {
    key: crypto.randomUUID(),
    variantId: "",
    quantity: 1,
    discountPercent: 0,
    taxPercent: 0,
    availableDevices: [],
  };
}

// Modal "Tạo đơn bán hàng" nhanh — bảng nhiều dòng hàng hóa (mọi loại: cà
// phê đóng gói + máy/thiết bị) với CK%/Thuế% từng dòng, giống layout ERP
// tham khảo. KHÔNG có trường Kho (công ty chỉ 1 kho). Đơn giá luôn lấy từ
// CSDL (giá riêng khách hàng nếu có) — CK%/Thuế% là cơ chế điều chỉnh hợp
// lệ duy nhất, không cho sửa giá tự do để tránh sai lệch giá bán.
// Serial vẫn bắt buộc chọn cho SKU quản lý theo Serial (§ bất biến hệ thống).
// Đơn tạo ra ở đây LUÔN ở trạng thái Xác nhận giống 2 luồng tạo đơn hiện có
// (/orders/new, /orders/new-equipment) — hệ thống hiện chưa hỗ trợ đơn Nháp.
export function SalesOrderQuickDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [allCustomers, setAllCustomers] = useState<CustomerRow[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerPrices, setCustomerPrices] = useState<Record<string, number>>({});

  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [paymentMethodCode, setPaymentMethodCode] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<QuickLine[]>([emptyLine()]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => setAllCustomers(d.customers ?? []));
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []));
    fetch("/api/payment-methods")
      .then((r) => r.json())
      .then((d) => setPaymentMethods(d.paymentMethods ?? []));
  }, [open]);

  useEffect(() => {
    if (!customerId) return;
    fetch(`/api/customers/${customerId}/prices`)
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, number> = {};
        for (const p of d.prices ?? []) map[p.product_variant_id] = p.unit_price;
        setCustomerPrices(map);
      });
  }, [customerId]);

  const sortedCustomers = useMemo(
    () => [...allCustomers].sort((a, b) => a.name.localeCompare(b.name, "vi")),
    [allCustomers]
  );

  // Chỉ những SKU thực sự bán được qua Đơn hàng: cà phê ĐÓNG GÓI + máy/
  // thiết bị/linh kiện — nhân xanh & cà phê rang rời bán qua Kho > Bán
  // hàng riêng (sellFinishedCoffee), không đi qua order_items.
  const sellableVariants: SellableVariant[] = useMemo(() => {
    return products
      .filter(
        (p) =>
          p.is_active &&
          ((p.product_type === "COFFEE" && !p.coffee_stage) ||
            (EQUIPMENT_PRODUCT_TYPES as readonly string[]).includes(p.product_type))
      )
      .flatMap((p) =>
        p.variants
          .filter((v) => v.is_active)
          .map((v) => ({ ...v, productId: p.id, productName: p.name }))
      );
  }, [products]);

  function variantById(id: string) {
    return sellableVariants.find((v) => v.id === id);
  }

  function priceFor(variant: SellableVariant) {
    return customerPrices[variant.id] ?? variant.unit_price;
  }

  function lineTotal(line: QuickLine) {
    const variant = variantById(line.variantId);
    if (!variant) return 0;
    const subtotal = priceFor(variant) * line.quantity;
    const afterDiscount = subtotal * (1 - line.discountPercent / 100);
    return Math.round(afterDiscount * (1 + line.taxPercent / 100));
  }

  const total = lines.reduce((sum, l) => sum + lineTotal(l), 0);

  function updateLine(key: string, patch: Partial<QuickLine>) {
    setLines((cur) => cur.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function onSelectVariant(key: string, variantId: string) {
    const variant = variantById(variantId);
    updateLine(key, { variantId, deviceId: undefined, quantity: 1, availableDevices: [] });
    if (variant?.requires_serial) {
      const res = await fetch(`/api/products/${variant.productId}/variants/${variant.id}/devices`);
      const data = await res.json();
      updateLine(key, { availableDevices: data.devices ?? [] });
    }
  }

  function addLine() {
    setLines((cur) => [...cur, emptyLine()]);
  }

  function removeLine(key: string) {
    setLines((cur) => (cur.length > 1 ? cur.filter((l) => l.key !== key) : cur));
  }

  async function onSubmit() {
    if (!customerId) return toast.error("Vui lòng chọn khách hàng");
    const validLines = lines.filter((l) => l.variantId);
    if (validLines.length === 0) return toast.error("Vui lòng thêm ít nhất 1 hàng hóa");

    for (const l of validLines) {
      const variant = variantById(l.variantId);
      if (variant?.requires_serial && !l.deviceId) {
        return toast.error(`Vui lòng chọn Serial cho ${variant.sku}`);
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          paymentMethodCode: paymentMethodCode || undefined,
          description: description || undefined,
          note: note || undefined,
          items: validLines.map((l) => ({
            productVariantId: l.variantId,
            quantity: l.quantity,
            deviceId: l.deviceId,
            discountPercent: l.discountPercent,
            taxPercent: l.taxPercent,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Tạo đơn thất bại");
      toast.success(`Đã tạo đơn ${data.order.order_code}`);
      setOpen(false);
      setLines([emptyLine()]);
      setCustomerId("");
      setDescription("");
      setNote("");
      setPaymentMethodCode("");
      router.push(`/orders/${data.order.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusCircle className="h-4 w-4" /> Tạo đơn bán hàng
      </Button>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Tạo đơn bán hàng</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Khách hàng</Label>
              <Select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setCustomerPrices({});
                }}
              >
                <option value="">-- Chọn --</option>
                {sortedCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `${c.code} - ${c.name}` : c.name}
                    {c.phone ? ` (${c.phone})` : ""}
                  </option>
                ))}
              </Select>
              <CustomerFormDialog
                trigger={
                  <Button variant="outline" size="sm" className="w-fit">
                    + Khách hàng mới
                  </Button>
                }
                onCreated={(c) => {
                  setAllCustomers((cur) => [...cur, c]);
                  setCustomerId(c.id);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Phương thức thanh toán</Label>
              <Select value={paymentMethodCode} onChange={(e) => setPaymentMethodCode(e.target.value)}>
                <option value="">-- Chọn --</option>
                {paymentMethods.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Diễn giải</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Ghi chú</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Chi tiết hàng hóa</Label>
            <div className="overflow-x-auto rounded-lg border border-stone-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <th className="p-2">Hàng hóa</th>
                    <th className="p-2 w-20">SL</th>
                    <th className="p-2 w-24">CK %</th>
                    <th className="p-2 w-24">Thuế %</th>
                    <th className="p-2 w-28 text-right">Thành tiền</th>
                    <th className="p-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const variant = variantById(l.variantId);
                    return (
                      <tr key={l.key} className="border-b border-stone-100 last:border-0 align-top">
                        <td className="p-2">
                          <Select value={l.variantId} onChange={(e) => onSelectVariant(l.key, e.target.value)}>
                            <option value="">-- Chọn hàng --</option>
                            {sellableVariants.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.sku} — {v.productName}
                              </option>
                            ))}
                          </Select>
                          {variant?.requires_serial && (
                            <Select
                              className="mt-1.5"
                              value={l.deviceId ?? ""}
                              onChange={(e) => updateLine(l.key, { deviceId: e.target.value, quantity: 1 })}
                            >
                              <option value="">-- Chọn Serial ({l.availableDevices.length}) --</option>
                              {l.availableDevices.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.serial_number}
                                </option>
                              ))}
                            </Select>
                          )}
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={1}
                            disabled={!!variant?.requires_serial}
                            value={l.quantity}
                            onChange={(e) => updateLine(l.key, { quantity: Number(e.target.value) || 1 })}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={l.discountPercent}
                            onChange={(e) => updateLine(l.key, { discountPercent: Number(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={l.taxPercent}
                            onChange={(e) => updateLine(l.key, { taxPercent: Number(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="p-2 text-right font-medium">{formatVnd(lineTotal(l))}</td>
                        <td className="p-2">
                          <button onClick={() => removeLine(l.key)} className="text-stone-400 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLine} className="w-fit">
              <PlusCircle className="h-4 w-4" /> Thêm dòng
            </Button>
          </div>

          <div className="flex justify-end border-t border-stone-100 pt-3 text-base font-bold text-amber-800">
            <span>Tổng thanh toán: {formatVnd(total)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Hủy
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? "Đang lưu..." : "Lưu chứng từ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
