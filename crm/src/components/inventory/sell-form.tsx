"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { formatKg, formatVnd } from "@/lib/utils";
import type { CustomerRow } from "@/types/db";

interface FinishedVariantOption {
  id: string;
  sku: string;
  productName: string;
  unitPrice: number;
  greenSku: string;
  greenQuantityOnHand: number;
}

export function SellForm({
  finishedVariants,
  ratio,
  shrinkagePercent,
}: {
  finishedVariants: FinishedVariantOption[];
  ratio: number;
  shrinkagePercent: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [finishedVariantId, setFinishedVariantId] = useState(finishedVariants[0]?.id ?? "");
  const [finishedKg, setFinishedKg] = useState<number | "">("");
  const [unitPrice, setUnitPrice] = useState<number | "">(finishedVariants[0]?.unitPrice ?? "");
  const [vatIncluded, setVatIncluded] = useState(false);
  const [vatPercent, setVatPercent] = useState<number | "">(8);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [note, setNote] = useState("");

  // customer picker — cùng kiểu dùng ở tạo đơn hàng (order-builder.tsx)
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerRow[]>([]);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!customerQuery) return setCustomerResults([]);
      const res = await fetch(`/api/customers?q=${encodeURIComponent(customerQuery)}`);
      if (res.ok) setCustomerResults((await res.json()).customers);
    }, 250);
    return () => clearTimeout(handle);
  }, [customerQuery]);

  const selected = finishedVariants.find((v) => v.id === finishedVariantId);

  function onSelectVariant(id: string) {
    setFinishedVariantId(id);
    const v = finishedVariants.find((f) => f.id === id);
    if (v) setUnitPrice(v.unitPrice);
  }

  const greenKgConsumed = useMemo(() => {
    if (!finishedKg || finishedKg <= 0) return 0;
    return Math.round((finishedKg / ratio) * 1000) / 1000;
  }, [finishedKg, ratio]);

  const greenRemaining = selected ? selected.greenQuantityOnHand - greenKgConsumed : 0;
  const insufficientStock = selected != null && greenKgConsumed > selected.greenQuantityOnHand;

  const subtotal = finishedKg && unitPrice ? Math.round(Number(finishedKg) * Number(unitPrice)) : 0;
  const vatAmount = vatIncluded && vatPercent ? Math.round((subtotal * Number(vatPercent)) / 100) : 0;
  const total = subtotal + vatAmount;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!finishedVariantId) return toast.error("Vui lòng chọn SKU cà phê thành phẩm");
    if (!finishedKg || finishedKg <= 0) return toast.error("Vui lòng nhập số kg thành phẩm bán");
    if (insufficientStock) return toast.error("Không đủ tồn nhân xanh để bán số kg này");

    setLoading(true);
    try {
      const res = await fetch("/api/inventory/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          finishedVariantId,
          finishedKg: Number(finishedKg),
          customerId: customer?.id,
          unitPrice: unitPrice === "" ? undefined : Number(unitPrice),
          vatIncluded,
          vatPercent: vatIncluded && vatPercent !== "" ? Number(vatPercent) : undefined,
          invoiceNumber: invoiceNumber || undefined,
          invoiceDate: invoiceDate || undefined,
          note: note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Bán hàng thất bại");
      toast.success(
        `Đã bán ${finishedKg}kg — trừ ${data.result.greenKgConsumed}kg nhân xanh (${selected?.greenSku})`
      );
      setFinishedKg("");
      setInvoiceNumber("");
      setNote("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (finishedVariants.length === 0) return null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="finishedVariantId">Cà phê thành phẩm bán *</Label>
        <Select
          id="finishedVariantId"
          value={finishedVariantId}
          onChange={(e) => onSelectVariant(e.target.value)}
          required
        >
          {finishedVariants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.sku} — {v.productName} (nguồn: {v.greenSku}, còn {formatKg(v.greenQuantityOnHand)})
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="finishedKg">Số kg thành phẩm bán *</Label>
          <Input
            id="finishedKg"
            type="number"
            step="0.01"
            min={0.01}
            required
            value={finishedKg}
            onChange={(e) => setFinishedKg(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="VD: 20"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unitPrice">Đơn giá bán (đ/kg)</Label>
          <Input
            id="unitPrice"
            type="number"
            min={0}
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value === "" ? "" : Number(e.target.value))}
          />
        </div>
      </div>

      {finishedKg !== "" && selected && (
        <div className={`rounded-lg border p-3 text-sm ${insufficientStock ? "border-red-300 bg-red-50" : "border-stone-200 bg-stone-50"}`}>
          <div className="flex justify-between">
            <span className="text-stone-500">Tỷ lệ hao hụt/chuyển đổi</span>
            <span>{shrinkagePercent}%</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Nguyên liệu tiêu hao ({selected.greenSku})</span>
            <span>{formatKg(greenKgConsumed)}</span>
          </div>
          <div className="flex justify-between text-stone-500">
            <span>Tồn nhân xanh trước</span>
            <span>{formatKg(selected.greenQuantityOnHand)}</span>
          </div>
          <div className={`flex justify-between ${insufficientStock ? "font-semibold text-red-700" : "text-stone-500"}`}>
            <span>Tồn nhân xanh sau</span>
            <span>{formatKg(greenRemaining)}</span>
          </div>
          {insufficientStock && <div className="mt-1 text-red-700">⚠️ Không đủ tồn nhân xanh để bán số kg này</div>}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label>Khách hàng</Label>
        {customer ? (
          <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm">
            <div>
              <div className="font-medium">{customer.name}</div>
              <div className="text-stone-500">{customer.phone}</div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setCustomer(null)}>
              Đổi
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                className="pl-9"
                placeholder="Tìm khách hàng theo tên/SĐT (bỏ trống nếu khách lẻ)..."
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
              />
            </div>
            {customerResults.length > 0 && (
              <div className="flex flex-col gap-1">
                {customerResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="rounded-lg border border-stone-200 p-2 text-left text-sm hover:border-amber-300"
                    onClick={() => setCustomer(c)}
                  >
                    <div className="font-medium">{c.name}</div>
                    <div className="text-stone-500">{c.phone}</div>
                  </button>
                ))}
              </div>
            )}
            <CustomerFormDialog trigger={<Button type="button" variant="outline" size="sm">+ Khách hàng mới</Button>} />
          </>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={vatIncluded} onCheckedChange={(v) => setVatIncluded(v === true)} />
        Xuất VAT
      </label>
      {vatIncluded && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vatPercent">VAT (%)</Label>
            <Input
              id="vatPercent"
              type="number"
              min={0}
              max={100}
              value={vatPercent}
              onChange={(e) => setVatPercent(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invoiceNumber">Số hóa đơn</Label>
            <Input id="invoiceNumber" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </div>
        </div>
      )}
      {vatIncluded && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invoiceDate">Ngày hóa đơn</Label>
          <Input id="invoiceDate" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
        </div>
      )}

      {finishedKg !== "" && (
        <div className="flex flex-col gap-1 border-t border-stone-100 pt-2 text-sm">
          <div className="flex justify-between text-stone-500">
            <span>Tạm tính</span>
            <span>{formatVnd(subtotal)}</span>
          </div>
          {vatIncluded && (
            <div className="flex justify-between text-stone-500">
              <span>VAT ({vatPercent || 0}%)</span>
              <span>{formatVnd(vatAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-amber-800">
            <span>Tổng cộng</span>
            <span>{formatVnd(total)}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">Ghi chú</Label>
        <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <Button type="submit" disabled={loading || insufficientStock} className="w-fit">
        {loading ? "Đang lưu..." : "Xác nhận bán"}
      </Button>
    </form>
  );
}
