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
import { EQUIPMENT_PRODUCT_TYPES } from "@/lib/constants";
import type { CustomerRow, ProductRow, ProductVariantRow, QuotationItemRow, QuotationRow, QuotePriceType, UserRow } from "@/types/db";

type ProductWithVariants = ProductRow & { variants: ProductVariantRow[] };
type SellableVariant = ProductVariantRow & { productId: string; productName: string };

const PRICE_TYPE_LABEL: Record<string, string> = {
  RETAIL: "Giá lẻ",
  WHOLESALE: "Giá sỉ",
  AGENT: "Giá đại lý",
  CUSTOM: "Giá tùy chỉnh",
};

interface QuoteLine {
  key: string;
  productVariantId: string; // "" = dòng tự do, không gắn SKU
  productName: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  vatPercent: number;
}

function emptyLine(): QuoteLine {
  return {
    key: crypto.randomUUID(),
    productVariantId: "",
    productName: "",
    description: "",
    unit: "Cái",
    quantity: 1,
    unitPrice: 0,
    discountPercent: 0,
    discountAmount: 0,
    vatPercent: 0,
  };
}

function lineTotal(line: QuoteLine) {
  const subtotal = line.unitPrice * line.quantity;
  const discount = line.discountAmount > 0 ? Math.min(line.discountAmount, subtotal) : Math.round(subtotal * (line.discountPercent / 100));
  const afterDiscount = subtotal - discount;
  return Math.round(afterDiscount * (1 + line.vatPercent / 100));
}

export interface QuotationBuilderInitial {
  quotation: QuotationRow;
  items: QuotationItemRow[];
}

// Form tạo/sửa báo giá — dùng chung cho /bao-gia/new và /bao-gia/[id]/edit.
// Cách chọn khách hàng/sản phẩm mô phỏng đúng SalesOrderQuickDialog (chọn
// có sẵn + tạo nhanh khách mới ngay trong form) để giữ trải nghiệm nhất
// quán với phần Tạo đơn hàng đã có.
export function QuotationBuilder({ initial }: { initial?: QuotationBuilderInitial }) {
  const router = useRouter();
  const isEdit = !!initial;
  const [submitting, setSubmitting] = useState(false);

  const [allCustomers, setAllCustomers] = useState<CustomerRow[]>([]);
  const [customerId, setCustomerId] = useState(initial?.quotation.customer_id ?? "");
  const [customerName, setCustomerName] = useState(initial?.quotation.customer_name_snapshot ?? "");
  const [customerPhone, setCustomerPhone] = useState(initial?.quotation.customer_phone_snapshot ?? "");
  const [customerCompany, setCustomerCompany] = useState(initial?.quotation.customer_company_snapshot ?? "");
  const [customerAddress, setCustomerAddress] = useState(initial?.quotation.customer_address_snapshot ?? "");
  const [customerTaxCode, setCustomerTaxCode] = useState(initial?.quotation.customer_tax_code_snapshot ?? "");
  const [customerEmail, setCustomerEmail] = useState(initial?.quotation.customer_email_snapshot ?? "");

  const [staff, setStaff] = useState<UserRow[]>([]);
  const [assignedTo, setAssignedTo] = useState(initial?.quotation.assigned_to ?? "");
  const [quoteDate, setQuoteDate] = useState(initial?.quotation.quote_date ?? new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState(initial?.quotation.valid_until ?? "");
  const [priceType, setPriceType] = useState(initial?.quotation.price_type ?? "RETAIL");
  const [shippingFee, setShippingFee] = useState<number | "">(initial?.quotation.shipping_fee ?? 0);
  const [note, setNote] = useState(initial?.quotation.note ?? "");

  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [lines, setLines] = useState<QuoteLine[]>(
    initial?.items.length
      ? initial.items.map((it) => ({
          key: crypto.randomUUID(),
          productVariantId: it.product_variant_id ?? "",
          productName: it.product_name,
          description: it.description ?? "",
          unit: it.unit,
          quantity: it.quantity,
          unitPrice: it.unit_price,
          discountPercent: it.discount_percent,
          discountAmount: it.discount_amount,
          vatPercent: it.vat_percent,
        }))
      : [emptyLine()]
  );

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => setAllCustomers(d.customers ?? []));
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []));
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) => setStaff(d.users ?? []))
      .catch(() => {});
  }, []);

  const sortedCustomers = useMemo(
    () => [...allCustomers].sort((a, b) => a.name.localeCompare(b.name, "vi")),
    [allCustomers]
  );

  // Cùng bộ lọc "bán được" với SalesOrderQuickDialog — cà phê đóng gói +
  // máy/thiết bị/linh kiện. Nhân xanh/rang rời (tồn KG lẻ) không đưa vào
  // báo giá qua đây để tránh số lượng lẻ không khớp CHECK quantity>0 dạng
  // số nguyên của order_items khi chuyển đơn sau này.
  const sellableVariants: SellableVariant[] = useMemo(() => {
    return products
      .filter(
        (p) =>
          p.is_active &&
          ((p.product_type === "COFFEE" && !p.coffee_stage) ||
            (EQUIPMENT_PRODUCT_TYPES as readonly string[]).includes(p.product_type))
      )
      .flatMap((p) => p.variants.filter((v) => v.is_active).map((v) => ({ ...v, productId: p.id, productName: p.name })));
  }, [products]);

  function onSelectCustomer(id: string) {
    setCustomerId(id);
    const c = allCustomers.find((x) => x.id === id);
    if (!c) return;
    setCustomerName(c.name);
    setCustomerPhone(c.phone ?? "");
    setCustomerCompany(c.company_name ?? "");
    setCustomerAddress(c.address ?? "");
    setCustomerTaxCode(c.tax_code ?? "");
    setCustomerEmail(c.email ?? "");
  }

  function updateLine(key: string, patch: Partial<QuoteLine>) {
    setLines((cur) => cur.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function onPickVariant(key: string, variantId: string) {
    const variant = sellableVariants.find((v) => v.id === variantId);
    if (!variant) {
      updateLine(key, { productVariantId: "" });
      return;
    }
    updateLine(key, {
      productVariantId: variant.id,
      productName: variant.productName,
      unit: variant.unit || "Cái",
      unitPrice: variant.unit_price,
    });
  }

  function addLine() {
    setLines((cur) => [...cur, emptyLine()]);
  }

  function removeLine(key: string) {
    setLines((cur) => (cur.length > 1 ? cur.filter((l) => l.key !== key) : cur));
  }

  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const totalDiscount = lines.reduce((sum, l) => {
    const lineSubtotal = l.unitPrice * l.quantity;
    return sum + (l.discountAmount > 0 ? Math.min(l.discountAmount, lineSubtotal) : Math.round(lineSubtotal * (l.discountPercent / 100)));
  }, 0);
  const totalVat = lines.reduce((sum, l) => {
    const lineSubtotal = l.unitPrice * l.quantity;
    const discount = l.discountAmount > 0 ? Math.min(l.discountAmount, lineSubtotal) : Math.round(lineSubtotal * (l.discountPercent / 100));
    return sum + Math.round((lineSubtotal - discount) * (l.vatPercent / 100));
  }, 0);
  const grandTotal = subtotal - totalDiscount + totalVat + (Number(shippingFee) || 0);

  async function onSave() {
    if (!customerId) return toast.error("Vui lòng chọn khách hàng");
    if (lines.some((l) => !l.productName.trim())) return toast.error("Mỗi dòng cần có tên sản phẩm");
    if (lines.some((l) => l.quantity <= 0)) return toast.error("Số lượng phải lớn hơn 0");

    setSubmitting(true);
    try {
      const payload = {
        customerId,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        customerCompany: customerCompany || undefined,
        customerAddress: customerAddress || undefined,
        customerTaxCode: customerTaxCode || undefined,
        customerEmail: customerEmail || undefined,
        quoteDate,
        validUntil: validUntil || undefined,
        priceType,
        assignedTo: assignedTo || undefined,
        shippingFee: Number(shippingFee) || 0,
        note: note || undefined,
        items: lines.map((l) => ({
          productVariantId: l.productVariantId || undefined,
          productName: l.productName,
          description: l.description || undefined,
          unit: l.unit || "Cái",
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountPercent: l.discountPercent || undefined,
          discountAmount: l.discountAmount || undefined,
          vatPercent: l.vatPercent || undefined,
        })),
      };

      const res = await fetch(isEdit ? `/api/quotations/${initial!.quotation.id}` : "/api/quotations", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Có lỗi xảy ra");
      toast.success(isEdit ? "Đã cập nhật báo giá" : "Đã lưu báo giá (Nháp)");
      router.push(`/bao-gia/${data.quotation.id}`);
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
            <CardTitle className="text-base">Thông tin báo giá</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label>Ngày báo giá</Label>
              <Input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Hiệu lực đến</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Nhân viên phụ trách</Label>
              <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                <option value="">-- Chọn --</option>
                {staff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Loại báo giá</Label>
              <Select value={priceType} onChange={(e) => setPriceType(e.target.value as QuotePriceType)}>
                {Object.entries(PRICE_TYPE_LABEL).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thông tin khách hàng</CardTitle>
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
                <Label>Tên khách hàng</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Số điện thoại</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Tên cửa hàng/công ty</Label>
                <Input value={customerCompany} onChange={(e) => setCustomerCompany(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>MST (nếu có)</Label>
                <Input value={customerTaxCode} onChange={(e) => setCustomerTaxCode(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label>Địa chỉ</Label>
                <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label>Email (nếu có)</Label>
                <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sản phẩm</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-stone-500">
                    <th className="py-1.5 pr-2">#</th>
                    <th className="py-1.5 pr-2">Sản phẩm</th>
                    <th className="py-1.5 pr-2">ĐVT</th>
                    <th className="py-1.5 pr-2 text-right">SL</th>
                    <th className="py-1.5 pr-2 text-right">Đơn giá</th>
                    <th className="py-1.5 pr-2 text-right">CK %</th>
                    <th className="py-1.5 pr-2 text-right">CK tiền</th>
                    <th className="py-1.5 pr-2 text-right">VAT %</th>
                    <th className="py-1.5 pr-2 text-right">Thành tiền</th>
                    <th className="py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={line.key} className="border-b border-stone-100 align-top">
                      <td className="py-2 pr-2 text-stone-500">{idx + 1}</td>
                      <td className="py-2 pr-2" style={{ minWidth: 220 }}>
                        <Select
                          value={line.productVariantId}
                          onChange={(e) => onPickVariant(line.key, e.target.value)}
                          className="mb-1"
                        >
                          <option value="">-- Tự nhập (không gắn danh mục) --</option>
                          {sellableVariants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.productName} — {v.sku}
                            </option>
                          ))}
                        </Select>
                        <Input
                          placeholder="Tên sản phẩm / mô tả hiển thị trên báo giá"
                          value={line.productName}
                          onChange={(e) => updateLine(line.key, { productName: e.target.value })}
                          className="mb-1"
                        />
                        <Input
                          placeholder="Mô tả thêm (nếu có)"
                          value={line.description}
                          onChange={(e) => updateLine(line.key, { description: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-2" style={{ minWidth: 70 }}>
                        <Input value={line.unit} onChange={(e) => updateLine(line.key, { unit: e.target.value })} />
                      </td>
                      <td className="py-2 pr-2" style={{ minWidth: 70 }}>
                        <Input
                          type="number"
                          min={1}
                          className="text-right"
                          value={line.quantity}
                          onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-2 pr-2" style={{ minWidth: 110 }}>
                        <Input
                          type="number"
                          min={0}
                          className="text-right"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(line.key, { unitPrice: Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-2 pr-2" style={{ minWidth: 70 }}>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          className="text-right"
                          value={line.discountPercent}
                          onChange={(e) => updateLine(line.key, { discountPercent: Number(e.target.value), discountAmount: 0 })}
                        />
                      </td>
                      <td className="py-2 pr-2" style={{ minWidth: 90 }}>
                        <Input
                          type="number"
                          min={0}
                          className="text-right"
                          value={line.discountAmount}
                          onChange={(e) => updateLine(line.key, { discountAmount: Number(e.target.value), discountPercent: 0 })}
                        />
                      </td>
                      <td className="py-2 pr-2" style={{ minWidth: 70 }}>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          className="text-right"
                          value={line.vatPercent}
                          onChange={(e) => updateLine(line.key, { vatPercent: Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-2 pr-2 whitespace-nowrap text-right font-medium">{formatVnd(lineTotal(line))}</td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          className="text-stone-400 hover:text-red-600"
                        >
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ghi chú báo giá</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={"VD: Giá áp dụng cho đơn từ 10kg\nGiá có thể thay đổi theo nguyên liệu đầu vào\nThời gian giao hàng: ...\nChính sách vận chuyển/thanh toán/bảo hành..."}
              rows={5}
            />
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
              <span className="text-stone-500">Tạm tính</span>
              <span>{formatVnd(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-500">Chiết khấu</span>
              <span className="text-red-600">-{formatVnd(totalDiscount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-500">VAT</span>
              <span>{formatVnd(totalVat)}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-stone-500">Phí vận chuyển</Label>
              <Input
                type="number"
                min={0}
                value={shippingFee}
                onChange={(e) => setShippingFee(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div className="flex items-center justify-between border-t border-stone-200 pt-2 text-base font-semibold">
              <span>Tổng cộng</span>
              <span>{formatVnd(grandTotal)}</span>
            </div>
            <Button size="lg" onClick={onSave} disabled={submitting} className="mt-2 w-full">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Lưu thay đổi" : "Lưu báo giá"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
