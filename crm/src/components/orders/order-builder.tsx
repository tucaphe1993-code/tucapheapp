"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, PlusCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { formatVnd } from "@/lib/utils";
import {
  DELIVERY_METHODS,
  EQUIPMENT_DELIVERY_METHODS,
  EQUIPMENT_PRODUCT_TYPES,
  PAYMENT_METHODS,
  PRODUCT_TYPE_LABEL,
} from "@/lib/constants";
import type { CustomerRow, DeviceRow, ProductRow, ProductVariantRow } from "@/types/db";

type ProductWithVariants = ProductRow & { variants: ProductVariantRow[] };

interface CartLine {
  variant: ProductVariantRow;
  productName: string;
  quantity: number;
  deviceId?: string;
  serialNumber?: string;
}

const FORM_LABEL: Record<string, string> = { HAT: "Hạt", BOT: "Bột" };
const PACKAGING_LABEL: Record<string, string> = { TUI_XANH: "Túi Xanh", TUI_ZIP: "Túi Zip" };

function lineKey(l: CartLine) {
  return l.deviceId ?? l.variant.id;
}

export function OrderBuilder({ mode }: { mode: "coffee" | "equipment" }) {
  const router = useRouter();
  const productTypes = mode === "coffee" ? (["COFFEE"] as const) : EQUIPMENT_PRODUCT_TYPES;
  const deliveryMethods = mode === "coffee" ? DELIVERY_METHODS : EQUIPMENT_DELIVERY_METHODS;

  // customer picker — dropdown liệt kê toàn bộ khách hàng hiện có, chọn
  // thẳng bằng mã KH thay vì phải gõ tìm.
  const [allCustomers, setAllCustomers] = useState<CustomerRow[]>([]);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [customerPrices, setCustomerPrices] = useState<Record<string, number>>({});
  const [contactPhone, setContactPhone] = useState("");
  const [contactAddress, setContactAddress] = useState("");

  // product picker
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [productId, setProductId] = useState("");
  const [form, setForm] = useState("HAT");
  const [packaging, setPackaging] = useState("TUI_XANH");
  const [weight, setWeight] = useState<number | "">("");
  const [variantId, setVariantId] = useState("");
  const [availableDevices, setAvailableDevices] = useState<DeviceRow[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [qty, setQty] = useState(1);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("");
  const [note, setNote] = useState("");
  const [depositAmount, setDepositAmount] = useState<number | "">("");
  const [depositMethod, setDepositMethod] = useState("");
  const [vatIncluded, setVatIncluded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // "Xem thử" chỉ hiển thị tạm bảng tổng kết đơn hàng từ dữ liệu đang nhập
  // trên form — không gọi API, không lưu gì cả — để kiểm tra lại trước khi
  // bấm "Tạo đơn" thật.
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []));
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => setAllCustomers(d.customers ?? []));
  }, []);

  const sortedCustomers = useMemo(
    () => [...allCustomers].sort((a, b) => a.name.localeCompare(b.name, "vi")),
    [allCustomers]
  );

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
  const isCoffee = selectedProduct?.product_type === "COFFEE";

  // Không phải dòng cà phê nào cũng có đủ 2x2 tổ hợp Hạt/Bột x Túi Xanh/
  // Túi Zip — chỉ hiện những lựa chọn THỰC SỰ có SKU, tránh chọn xong Quy
  // cách trống trơn (không có SKU nào khớp).
  const availableForms = useMemo(() => {
    if (!selectedProduct || !isCoffee) return [];
    return [...new Set(selectedProduct.variants.filter((v) => v.is_active && v.form).map((v) => v.form as string))];
  }, [selectedProduct, isCoffee]);

  // Sản phẩm đổi mà Hạt/Bột đang chọn không còn hợp lệ (dòng mới không có
  // SKU đó) → rơi về lựa chọn hợp lệ đầu tiên, tính trực tiếp thay vì đồng
  // bộ qua state để tránh set-state-trong-effect và double render.
  const effectiveForm = availableForms.includes(form) ? form : (availableForms[0] ?? form);

  const availablePackagings = useMemo(() => {
    if (!selectedProduct || !isCoffee) return [];
    return [
      ...new Set(
        selectedProduct.variants
          .filter((v) => v.is_active && v.form === effectiveForm && v.packaging)
          .map((v) => v.packaging as string)
      ),
    ];
  }, [selectedProduct, isCoffee, effectiveForm]);

  const effectivePackaging = availablePackagings.includes(packaging)
    ? packaging
    : (availablePackagings[0] ?? packaging);

  const availableWeights = useMemo(() => {
    if (!selectedProduct || !isCoffee) return [];
    return selectedProduct.variants
      .filter((v) => v.form === effectiveForm && v.packaging === effectivePackaging && v.is_active)
      .map((v) => v.weight_grams as number)
      .sort((a, b) => a - b);
  }, [selectedProduct, isCoffee, effectiveForm, effectivePackaging]);

  const matchedVariant = isCoffee
    ? selectedProduct?.variants.find(
        (v) => v.form === effectiveForm && v.packaging === effectivePackaging && v.weight_grams === weight
      )
    : selectedProduct?.variants.find((v) => v.id === variantId);

  const selectedProductId = selectedProduct?.id;
  const matchedVariantId = matchedVariant?.id;
  const matchedVariantRequiresSerial = matchedVariant?.requires_serial;

  useEffect(() => {
    if (!selectedProductId || !matchedVariantId || !matchedVariantRequiresSerial) return;
    fetch(`/api/products/${selectedProductId}/variants/${matchedVariantId}/devices`)
      .then((r) => r.json())
      .then((d) => {
        setAvailableDevices(d.devices ?? []);
        setDeviceId("");
      });
  }, [selectedProductId, matchedVariantId, matchedVariantRequiresSerial]);

  function addToCart() {
    if (!selectedProduct || !matchedVariant) {
      toast.error("Vui lòng chọn đầy đủ thông tin sản phẩm");
      return;
    }
    if (matchedVariant.requires_serial) {
      const device = availableDevices.find((d) => d.id === deviceId);
      if (!device) {
        toast.error("Vui lòng chọn Serial");
        return;
      }
      setCart((cur) => [
        ...cur,
        {
          variant: matchedVariant,
          productName: selectedProduct.name,
          quantity: 1,
          deviceId: device.id,
          serialNumber: device.serial_number,
        },
      ]);
      setAvailableDevices((cur) => cur.filter((d) => d.id !== device.id));
      setDeviceId("");
      return;
    }

    if (qty <= 0) {
      toast.error("Số lượng phải lớn hơn 0");
      return;
    }
    setCart((cur) => {
      const existing = cur.find((l) => !l.deviceId && l.variant.id === matchedVariant.id);
      if (existing) {
        return cur.map((l) =>
          !l.deviceId && l.variant.id === matchedVariant.id ? { ...l, quantity: l.quantity + qty } : l
        );
      }
      return [...cur, { variant: matchedVariant, productName: selectedProduct.name, quantity: qty }];
    });
    setQty(1);
  }

  function removeLine(key: string) {
    setCart((cur) => cur.filter((l) => lineKey(l) !== key));
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
          customerPhone: mode === "equipment" ? contactPhone || undefined : undefined,
          customerAddress: mode === "equipment" ? contactAddress || undefined : undefined,
          deliveryDate: deliveryDate || undefined,
          deliveryMethod: deliveryMethod || undefined,
          note: note || undefined,
          vatIncluded: mode === "equipment" ? vatIncluded : undefined,
          depositAmount: mode === "equipment" && depositAmount !== "" ? depositAmount : undefined,
          depositMethod: mode === "equipment" ? depositMethod || undefined : undefined,
          items: cart.map((l) => ({
            productVariantId: l.variant.id,
            quantity: l.quantity,
            deviceId: l.deviceId,
          })),
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
              <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{customer.name}</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCustomer(null);
                      setContactPhone("");
                      setContactAddress("");
                    }}
                  >
                    Đổi
                  </Button>
                </div>
                {mode === "equipment" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-stone-500">Số điện thoại liên hệ</Label>
                      <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                    </div>
                    <div className="col-span-2 flex flex-col gap-1">
                      <Label className="text-xs text-stone-500">Địa chỉ lắp đặt</Label>
                      <Input value={contactAddress} onChange={(e) => setContactAddress(e.target.value)} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-stone-500">{customer.phone}</div>
                    {customer.address && <div className="text-sm text-stone-500">{customer.address}</div>}
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label>Khách hàng</Label>
                  <Select
                    value=""
                    onChange={(e) => {
                      const c = allCustomers.find((x) => x.id === e.target.value);
                      if (!c) return;
                      setCustomer(c);
                      setContactPhone(c.phone ?? "");
                      setContactAddress(c.address ?? "");
                    }}
                  >
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
                  trigger={<Button variant="outline" size="sm">+ Khách hàng mới</Button>}
                  onCreated={(c) => {
                    setAllCustomers((cur) => [...cur, c]);
                    setCustomer(c);
                    setContactPhone(c.phone ?? "");
                    setContactAddress(c.address ?? "");
                  }}
                />
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
              <Label>Sản phẩm</Label>
              <Select
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setWeight("");
                  setVariantId("");
                }}
              >
                <option value="">-- Chọn sản phẩm --</option>
                {productTypes.length === 1
                  ? products
                      .filter((p) => p.product_type === productTypes[0] && p.is_active)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))
                  : productTypes.map((type) => {
                      const group = products.filter((p) => p.product_type === type && p.is_active);
                      if (group.length === 0) return null;
                      return (
                        <optgroup key={type} label={PRODUCT_TYPE_LABEL[type]}>
                          {group.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
              </Select>
            </div>

            {selectedProduct && isCoffee && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Hạt / Bột</Label>
                    <Select
                      value={effectiveForm}
                      onChange={(e) => {
                        setForm(e.target.value);
                        setPackaging("");
                        setWeight("");
                      }}
                    >
                      {availableForms.map((f) => (
                        <option key={f} value={f}>
                          {FORM_LABEL[f] ?? f}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Bao bì</Label>
                    <Select
                      value={effectivePackaging}
                      onChange={(e) => {
                        setPackaging(e.target.value);
                        setWeight("");
                      }}
                    >
                      {availablePackagings.map((p) => (
                        <option key={p} value={p}>
                          {PACKAGING_LABEL[p] ?? p}
                        </option>
                      ))}
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
              </>
            )}

            {selectedProduct && !isCoffee && (
              <div className="flex flex-col gap-1.5">
                <Label>Biến thể / SKU</Label>
                <Select value={variantId} onChange={(e) => setVariantId(e.target.value)}>
                  <option value="">-- Chọn SKU --</option>
                  {selectedProduct.variants
                    .filter((v) => v.is_active)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.sku}
                        {v.model ? ` — ${v.model}` : ""}
                      </option>
                    ))}
                </Select>
              </div>
            )}

            {matchedVariant?.requires_serial && (
              <div className="flex flex-col gap-1.5">
                <Label>Chọn Serial *</Label>
                <Select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
                  <option value="">-- Chọn Serial ({availableDevices.length} còn trong kho) --</option>
                  {availableDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.serial_number}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {matchedVariant && (
              <div className="rounded-lg bg-stone-50 p-2 text-sm font-medium">
                {formatVnd(priceFor(matchedVariant))}
                {customerPrices[matchedVariant.id] !== undefined && (
                  <span className="ml-2 text-xs font-normal text-amber-700">(giá riêng khách hàng)</span>
                )}
              </div>
            )}

            <div className="flex items-end gap-3">
              {!matchedVariant?.requires_serial && (
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
              )}
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
                {deliveryMethods.map((m) => (
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

        {mode === "equipment" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">4. Thanh toán</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Khách đã cọc</Label>
                  <Input
                    type="number"
                    min={0}
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Hình thức cọc</Label>
                  <Select value={depositMethod} onChange={(e) => setDepositMethod(e.target.value)}>
                    <option value="">-- Chọn --</option>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-stone-50 p-2.5 text-sm">
                <span className="text-stone-500">Còn lại</span>
                <span className="font-semibold">{formatVnd(Math.max(0, total - (Number(depositAmount) || 0)))}</span>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={vatIncluded} onCheckedChange={(v) => setVatIncluded(v === true)} />
                Giá đã bao gồm VAT
              </label>
            </CardContent>
          </Card>
        )}
      </div>

      <div>
        <Card className="lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle className="text-base">Giỏ hàng ({cart.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {cart.length === 0 && <p className="text-sm text-stone-400">Chưa có sản phẩm</p>}
            {cart.map((l) => (
              <div key={lineKey(l)} className="flex items-center justify-between border-b border-stone-100 pb-2 text-sm">
                <div>
                  <div className="font-medium">{l.productName}</div>
                  <div className="text-stone-500">
                    {l.serialNumber ? (
                      <>Serial: {l.serialNumber}</>
                    ) : l.variant.form ? (
                      <>
                        {FORM_LABEL[l.variant.form]} · {PACKAGING_LABEL[l.variant.packaging!]} ·{" "}
                        {l.variant.weight_grams! >= 1000
                          ? `${l.variant.weight_grams! / 1000}kg`
                          : `${l.variant.weight_grams}g`}{" "}
                        x{l.quantity}
                      </>
                    ) : (
                      <>
                        {l.variant.sku} x{l.quantity}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatVnd(priceFor(l.variant) * l.quantity)}</span>
                  <button onClick={() => removeLine(lineKey(l))} className="text-stone-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 font-semibold">
              <span>Tổng cộng</span>
              <span>{formatVnd(total)}</span>
            </div>
            <Button
              variant="outline"
              className="mt-2 w-full"
              disabled={cart.length === 0}
              onClick={() => setPreviewOpen(true)}
            >
              Xem thử đơn nháp
            </Button>
            <Button size="lg" onClick={onSubmit} disabled={submitting} className="w-full">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Tạo đơn
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Xem thử đơn hàng (chưa lưu)</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm">
            <div className="rounded-lg bg-amber-50 p-3">
              <div className="font-medium">{customer ? customer.name : "Khách lẻ (chưa chọn khách hàng)"}</div>
              {mode === "equipment" ? (
                <>
                  {contactPhone && <div className="text-stone-500">{contactPhone}</div>}
                  {contactAddress && <div className="text-stone-500">{contactAddress}</div>}
                </>
              ) : (
                <>
                  {customer?.phone && <div className="text-stone-500">{customer.phone}</div>}
                  {customer?.address && <div className="text-stone-500">{customer.address}</div>}
                </>
              )}
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="pb-1.5 font-normal">Sản phẩm</th>
                  <th className="pb-1.5 text-right font-normal">SL</th>
                  <th className="pb-1.5 text-right font-normal">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((l) => (
                  <tr key={lineKey(l)} className="border-b border-stone-100">
                    <td className="py-1.5">
                      <div>{l.productName}</div>
                      <div className="text-xs text-stone-500">
                        {l.serialNumber ? (
                          <>Serial: {l.serialNumber}</>
                        ) : l.variant.form ? (
                          <>
                            {FORM_LABEL[l.variant.form]} · {PACKAGING_LABEL[l.variant.packaging!]} ·{" "}
                            {l.variant.weight_grams! >= 1000
                              ? `${l.variant.weight_grams! / 1000}kg`
                              : `${l.variant.weight_grams}g`}
                          </>
                        ) : (
                          <>{l.variant.sku}</>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 text-right align-top">{l.quantity}</td>
                    <td className="py-1.5 text-right align-top font-medium">
                      {formatVnd(priceFor(l.variant) * l.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-col gap-1 border-t border-dashed border-stone-300 pt-2">
              <div className="flex justify-between font-semibold">
                <span>Tổng cộng</span>
                <span>{formatVnd(total)}</span>
              </div>
              {mode === "equipment" && Number(depositAmount) > 0 && (
                <>
                  <div className="flex justify-between text-stone-500">
                    <span>Đã cọc</span>
                    <span>{formatVnd(Number(depositAmount))}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Còn lại</span>
                    <span>{formatVnd(Math.max(0, total - (Number(depositAmount) || 0)))}</span>
                  </div>
                </>
              )}
            </div>

            {(deliveryDate || deliveryMethod || note) && (
              <div className="rounded-lg bg-stone-50 p-3 text-stone-600">
                {deliveryDate && <div>Ngày giao: {deliveryDate}</div>}
                {deliveryMethod && <div>Cách thức giao: {deliveryMethod}</div>}
                {note && <div>Ghi chú: {note}</div>}
              </div>
            )}

            <p className="text-xs text-stone-400">
              Đây là bản xem thử — chưa lưu vào hệ thống, chưa trừ kho/tạo công nợ. Bấm &quot;Tạo đơn&quot; để lưu thật.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Đóng
            </Button>
            <Button
              onClick={() => {
                setPreviewOpen(false);
                onSubmit();
              }}
              disabled={submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Tạo đơn ngay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
