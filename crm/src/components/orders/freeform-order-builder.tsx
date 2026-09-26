"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusCircle, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { formatVnd } from "@/lib/utils";
import type { CustomerRow, PaymentMethodRow } from "@/types/db";

interface FreeformLine {
  key: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  warrantyMonths: number;
  discountPercent: number;
  taxPercent: number;
}

function emptyLine(): FreeformLine {
  return {
    key: crypto.randomUUID(),
    productName: "",
    unit: "Cái",
    quantity: 1,
    unitPrice: 0,
    warrantyMonths: 0,
    discountPercent: 0,
    taxPercent: 0,
  };
}

function lineTotal(line: FreeformLine) {
  const subtotal = line.unitPrice * line.quantity;
  const afterDiscount = subtotal * (1 - line.discountPercent / 100);
  return Math.round(afterDiscount * (1 + line.taxPercent / 100));
}

// "Đơn hàng tự do" — bán máy pha/máy xay cũ, đã qua sử dụng, không có
// trong danh mục: tự gõ tên + đơn giá + số tháng bảo hành cho từng dòng,
// không chọn từ danh mục, không quản lý Serial. Submit thẳng vào
// POST /api/orders với item.freeformName/freeformUnitPrice — server tự
// sinh 1 SKU "ẩn" cho mỗi dòng (xem createFreeformVariant) nên hoá đơn,
// chi tiết đơn, phiếu bảo hành, biên bản bàn giao dùng lại nguyên xi,
// không cần trang riêng nào khác.
export function FreeformOrderBuilder() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [allCustomers, setAllCustomers] = useState<CustomerRow[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactAddress, setContactAddress] = useState("");

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [paymentMethodCode, setPaymentMethodCode] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<FreeformLine[]>([emptyLine()]);
  const [discountAmount, setDiscountAmount] = useState<number | "">(0);
  const [depositAmount, setDepositAmount] = useState<number | "">(0);

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => setAllCustomers(d.customers ?? []));
    fetch("/api/payment-methods")
      .then((r) => r.json())
      .then((d) => setPaymentMethods(d.paymentMethods ?? []));
  }, []);

  const sortedCustomers = useMemo(
    () => [...allCustomers].sort((a, b) => a.name.localeCompare(b.name, "vi")),
    [allCustomers]
  );

  function onSelectCustomer(id: string) {
    setCustomerId(id);
    const c = allCustomers.find((x) => x.id === id);
    setContactPhone(c?.phone ?? "");
    setContactAddress(c?.address ?? "");
  }

  function updateLine(key: string, patch: Partial<FreeformLine>) {
    setLines((cur) => cur.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((cur) => [...cur, emptyLine()]);
  }

  function removeLine(key: string) {
    setLines((cur) => (cur.length > 1 ? cur.filter((l) => l.key !== key) : cur));
  }

  const subtotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const discount = Math.min(Number(discountAmount) || 0, subtotal);
  const total = subtotal - discount;
  const deposit = Math.min(Number(depositAmount) || 0, total);
  const remaining = total - deposit;

  async function onSubmit() {
    if (!customerId) return toast.error("Vui lòng chọn khách hàng");
    if (lines.some((l) => !l.productName.trim())) return toast.error("Mỗi dòng cần có tên sản phẩm");
    if (lines.some((l) => l.quantity <= 0)) return toast.error("Số lượng phải lớn hơn 0");
    if (lines.some((l) => l.unitPrice <= 0)) return toast.error("Đơn giá phải lớn hơn 0");

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          customerPhone: contactPhone || undefined,
          customerAddress: contactAddress || undefined,
          paymentMethodCode: paymentMethodCode || undefined,
          description: description || undefined,
          note: note || undefined,
          discountAmount: discount || undefined,
          depositAmount: deposit || undefined,
          depositMethod: paymentMethods.find((m) => m.code === paymentMethodCode)?.name,
          items: lines.map((l) => ({
            freeformName: l.productName,
            freeformUnitPrice: l.unitPrice,
            freeformWarrantyMonths: l.warrantyMonths || undefined,
            quantity: l.quantity,
            discountPercent: l.discountPercent || undefined,
            taxPercent: l.taxPercent || undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Tạo đơn thất bại");
      toast.success(`Đã tạo đơn ${data.order.order_code}`);
      router.push(`/orders/${data.order.id}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Khách hàng</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-end gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label>Khách hàng có sẵn</Label>
                <Select value={customerId} onChange={(e) => onSelectCustomer(e.target.value)}>
                  <option value="">-- Chọn khách hàng --</option>
                  {sortedCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code ? `${c.code} - ${c.name}` : c.name}
                      {c.phone ? ` (${c.phone})` : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <CustomerFormDialog
                trigger={
                  <Button variant="outline" size="sm" className="w-fit shrink-0">
                    + Khách hàng mới
                  </Button>
                }
                onCreated={(c) => {
                  setAllCustomers((cur) => [...cur, c]);
                  onSelectCustomer(c.id);
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Số điện thoại liên hệ</Label>
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Địa chỉ giao/lắp đặt</Label>
                <Input value={contactAddress} onChange={(e) => setContactAddress(e.target.value)} />
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
              <div className="flex flex-col gap-1.5">
                <Label>Diễn giải</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sản phẩm (tự nhập tên, giá, bảo hành)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-stone-500">
                    <th className="py-1.5 pr-2">#</th>
                    <th className="py-1.5 pr-2">Tên sản phẩm</th>
                    <th className="py-1.5 pr-2">ĐVT</th>
                    <th className="py-1.5 pr-2 text-right">SL</th>
                    <th className="py-1.5 pr-2 text-right">Đơn giá</th>
                    <th className="py-1.5 pr-2 text-right">BH (tháng)</th>
                    <th className="py-1.5 pr-2 text-right">CK %</th>
                    <th className="py-1.5 pr-2 text-right">Thuế %</th>
                    <th className="py-1.5 pr-2 text-right">Thành tiền</th>
                    <th className="py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={line.key} className="border-b border-stone-100 align-top">
                      <td className="py-2 pr-2 text-stone-500">{idx + 1}</td>
                      <td className="py-2 pr-2" style={{ minWidth: 200 }}>
                        <Input
                          placeholder="VD: Máy pha cà phê Breville cũ 90%"
                          value={line.productName}
                          onChange={(e) => updateLine(line.key, { productName: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-2" style={{ minWidth: 70 }}>
                        <Input value={line.unit} onChange={(e) => updateLine(line.key, { unit: e.target.value })} />
                      </td>
                      <td className="py-2 pr-2" style={{ minWidth: 60 }}>
                        <Input
                          type="number"
                          min={1}
                          className="text-right"
                          value={line.quantity}
                          onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) || 1 })}
                        />
                      </td>
                      <td className="py-2 pr-2" style={{ minWidth: 110 }}>
                        <Input
                          type="number"
                          min={0}
                          className="text-right"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(line.key, { unitPrice: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="py-2 pr-2" style={{ minWidth: 80 }}>
                        <Input
                          type="number"
                          min={0}
                          className="text-right"
                          value={line.warrantyMonths}
                          onChange={(e) => updateLine(line.key, { warrantyMonths: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="py-2 pr-2" style={{ minWidth: 70 }}>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          className="text-right"
                          value={line.discountPercent}
                          onChange={(e) => updateLine(line.key, { discountPercent: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="py-2 pr-2" style={{ minWidth: 70 }}>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          className="text-right"
                          value={line.taxPercent}
                          onChange={(e) => updateLine(line.key, { taxPercent: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="py-2 pr-2 whitespace-nowrap text-right font-medium">{formatVnd(lineTotal(line))}</td>
                      <td className="py-2">
                        <button type="button" onClick={() => removeLine(line.key)} className="text-stone-400 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addLine}>
              <PlusCircle className="h-4 w-4" /> Thêm sản phẩm
            </Button>
            <p className="text-xs text-stone-400">
              Bảo hành 0 tháng = không bảo hành. Mỗi dòng vẫn vào được biên bản bàn giao/phiếu bảo hành như máy trong
              danh mục, chỉ khác là không quản lý theo Serial.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ghi chú</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
          </CardContent>
        </Card>
      </div>

      <div>
        <Card className="lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle className="text-base">Tổng kết</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-500">Tiền hàng</span>
              <span>{formatVnd(subtotal)}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-stone-500">Giảm giá (đ)</Label>
              <Input
                type="number"
                min={0}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div className="flex items-center justify-between border-t border-stone-200 pt-2 text-base font-bold text-amber-800">
              <span>Tổng thanh toán</span>
              <span>{formatVnd(total)}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-stone-500">Đã cọc (đ)</Label>
              <Input
                type="number"
                min={0}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            {deposit > 0 && (
              <div className="flex items-center justify-between text-sm font-medium text-red-600">
                <span>Còn lại</span>
                <span>{formatVnd(remaining)}</span>
              </div>
            )}
            <Button size="lg" onClick={onSubmit} disabled={submitting} className="mt-2 w-full">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Lưu đơn hàng
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
