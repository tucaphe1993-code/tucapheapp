"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { PAYMENT_METHODS } from "@/lib/constants";
import {
  formatFullDate,
  kgToPacks,
  pickDefaultVariant,
  relativeDayLabel,
  toDateKey,
  variantLabel,
  type QuickVariant,
} from "@/lib/quick";
import type { QuickFormData } from "@/lib/services/quick";
import { formatKg, formatVnd } from "@/lib/utils";
import { Chip } from "./chip";
import { ActionBar, CustomerPicker, DateField, Field, Header, postJson } from "./form-parts";

type PaymentChoice = "unpaid" | "partial" | "paid";
const PAYMENT_LABEL: Record<PaymentChoice, string> = {
  unpaid: "Chưa thanh toán",
  partial: "Thanh toán một phần",
  paid: "Đã thanh toán",
};
const QTY_PRESETS = [1, 2, 5, 10, 20];

/**
 * Bản nháp đơn — thứ màn XÁC NHẬN hiển thị trước khi lưu. Form bấm tay
 * (Phase 1) và giọng nói/AI (Phase 3, 5) chỉ cần điền object này.
 * customerId = null + newCustomerName = khách mới, tạo lúc bấm LƯU ĐƠN.
 */
export interface QuickDraft {
  customerId: string | null;
  newCustomerName: string | null;
  productId: string | null;
  variantId: string | null;
  /** KG với quy cách theo khối lượng; số lượng (cái/túi) nếu quy cách không có khối lượng. */
  amount: number | null;
  deliveryDate: string | null;
  payment: PaymentChoice;
  paidAmount: number | null;
  payMethod: string;
  note: string;
}

const EMPTY_DRAFT: QuickDraft = {
  customerId: null,
  newCustomerName: null,
  productId: null,
  variantId: null,
  amount: null,
  deliveryDate: null,
  payment: "unpaid",
  paidAmount: null,
  payMethod: PAYMENT_METHODS[0],
  note: "",
};

export function QuickOrderForm({ data }: { data: QuickFormData }) {
  const router = useRouter();
  const [draft, setDraft] = useState<QuickDraft>(EMPTY_DRAFT);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [saving, setSaving] = useState(false);
  const [customerPrices, setCustomerPrices] = useState<Record<string, number>>({});
  const set = (patch: Partial<QuickDraft>) => setDraft((d) => ({ ...d, ...patch }));

  // Giá riêng của khách (customer_prices) — CRM tự áp khi tạo đơn, ở đây
  // tải về chỉ để hiển thị đúng thành tiền trước khi lưu.
  useEffect(() => {
    if (!draft.customerId) return;
    let cancelled = false;
    fetch(`/api/customers/${draft.customerId}/prices`)
      .then((r) => r.json())
      .then((d: { prices?: { product_variant_id: string; unit_price: number }[] }) => {
        if (cancelled) return;
        setCustomerPrices(Object.fromEntries((d.prices ?? []).map((p) => [p.product_variant_id, p.unit_price])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [draft.customerId]);

  const customer = data.customers.find((c) => c.id === draft.customerId) ?? null;
  const product = data.products.find((p) => p.id === draft.productId) ?? null;
  const variant = product?.variants.find((v) => v.id === draft.variantId) ?? null;
  const byWeight = !!variant?.weight_grams;
  const quantity = variant && draft.amount ? (byWeight ? kgToPacks(draft.amount, variant.weight_grams!) : Number.isInteger(draft.amount) ? draft.amount : null) : null;
  const unitPrice = variant ? (draft.customerId ? (customerPrices[variant.id] ?? variant.unit_price) : variant.unit_price) : 0;
  const total = quantity ? quantity * unitPrice : 0;

  const problems: string[] = [];
  if (!draft.customerId && !draft.newCustomerName) problems.push("Chọn khách hàng");
  else if (!product || !variant) problems.push("Chọn sản phẩm");
  else if (!draft.amount) problems.push("Chọn số lượng");
  else if (!quantity) problems.push(byWeight ? `Số kg phải chia hết túi ${formatKg(variant.weight_grams! / 1000)}` : "Số lượng phải là số nguyên");
  else if (draft.payment === "partial" && !(draft.paidAmount && draft.paidAmount > 0 && draft.paidAmount < total))
    problems.push("Nhập số tiền đã trả");

  function selectProduct(productId: string) {
    const p = data.products.find((x) => x.id === productId)!;
    const v = pickDefaultVariant(p.variants, {
      lastForCustomer: draft.customerId ? data.lastVariants[draft.customerId]?.[p.id] : null,
      mostOrdered: p.most_ordered_variant_id,
    });
    set({ productId, variantId: v?.id ?? null });
  }

  async function save() {
    if (!variant || !quantity) return;
    setSaving(true);
    try {
      let customerId = draft.customerId;
      if (!customerId && draft.newCustomerName) {
        const res = await postJson("/api/customers", { name: draft.newCustomerName });
        customerId = res.customer.id as string;
      }
      const { order } = await postJson("/api/orders", {
        customerId,
        deliveryDate: draft.deliveryDate ?? undefined,
        note: draft.note.trim() || undefined,
        items: [{ productVariantId: variant.id, quantity }],
      });

      // Ghi thanh toán qua đúng API CRM (tự ghi luôn phiếu thu Sổ quỹ).
      const amount = draft.payment === "paid" ? order.total_amount : draft.payment === "partial" ? draft.paidAmount : 0;
      if (amount && amount > 0) {
        try {
          await postJson(`/api/orders/${order.id}/payments`, { amount, method: draft.payMethod });
        } catch (e) {
          toast.error(`Đã lưu đơn ${order.order_code} nhưng chưa ghi được thanh toán: ${(e as Error).message}`);
          router.replace("/quick");
          router.refresh();
          return;
        }
      }
      toast.success(`Đã lưu đơn ${order.order_code} ✓`);
      router.replace("/quick");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  }

  if (step === "confirm" && variant && quantity) {
    const today = toDateKey(new Date());
    const rows: [string, ReactNode][] = [
      [
        "Khách hàng",
        customer ? (
          customer.name
        ) : (
          <>
            {draft.newCustomerName} <span className="text-[15px] font-semibold text-moss-700">(khách mới)</span>
          </>
        ),
      ],
      ["Sản phẩm", `${product!.name}`],
      [
        "Số lượng",
        <>
          {byWeight ? formatKg(draft.amount!) : `${quantity} ${variant.unit ?? ""}`}{" "}
          <span className="text-[15px] font-semibold text-stone-500">
            ({byWeight ? `${quantity} túi · ` : ""}
            {variantLabel(variant)})
          </span>
        </>,
      ],
      [
        "Ngày giao",
        draft.deliveryDate ? (
          <>
            {formatFullDate(draft.deliveryDate)}{" "}
            <span className="text-[15px] font-semibold text-stone-500">({relativeDayLabel(draft.deliveryDate, today).toLowerCase()})</span>
          </>
        ) : (
          "Không hẹn"
        ),
      ],
      [
        "Thanh toán",
        draft.payment === "partial"
          ? `Đã trả ${formatVnd(draft.paidAmount!)} (${draft.payMethod})`
          : draft.payment === "paid"
            ? `Đã thanh toán (${draft.payMethod})`
            : PAYMENT_LABEL.unpaid,
      ],
    ];
    if (draft.note.trim()) rows.push(["Ghi chú", draft.note.trim()]);

    return (
      <>
        <Header title="Xác nhận đơn" onBack={() => setStep("form")} />
        <div className="px-5 pt-6">
          <dl className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
            {rows.map(([label, value]) => (
              <div key={label} className="px-4 py-3.5">
                <dt className="text-[13px] font-bold uppercase tracking-wide text-stone-500">{label}</dt>
                <dd className="mt-0.5 text-xl font-bold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 flex items-baseline justify-between px-1 text-stone-500">
            <span>
              {quantity} × {formatVnd(unitPrice)}
            </span>
            <span className="text-2xl font-extrabold text-moss-800">{formatVnd(total)}</span>
          </p>
          {draft.payment !== "paid" && (
            <p className="px-1 text-right text-[15px] font-semibold text-red-700">
              Còn nợ {formatVnd(total - (draft.payment === "partial" ? draft.paidAmount ?? 0 : 0))}
            </p>
          )}
        </div>
        <ActionBar>
          <button
            type="button"
            onClick={() => setStep("form")}
            disabled={saving}
            className="h-14 flex-1 rounded-2xl border-2 border-moss-700 text-lg font-extrabold text-moss-700 active:bg-moss-50"
          >
            SỬA
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="h-14 flex-[2] rounded-2xl bg-moss-700 text-lg font-extrabold text-white active:bg-moss-800 disabled:opacity-60"
          >
            {saving ? "Đang lưu…" : "LƯU ĐƠN"}
          </button>
        </ActionBar>
      </>
    );
  }

  return (
    <>
      <Header title="Ghi đơn nhanh" onBack={() => router.push("/quick")} />
      <div className="pb-4">
        <Field label="Khách hàng">
          <CustomerPicker
            customers={data.customers}
            selected={customer}
            newName={draft.newCustomerName}
            onChange={(v) => {
              setCustomerPrices({});
              // Đổi khách → quy cách mặc định theo lịch sử của khách mới.
              const p = product;
              const variantId = p
                ? (pickDefaultVariant(p.variants, {
                    lastForCustomer: v.customerId ? data.lastVariants[v.customerId]?.[p.id] : null,
                    mostOrdered: p.most_ordered_variant_id,
                  })?.id ?? null)
                : draft.variantId;
              set({ ...v, variantId });
            }}
          />
        </Field>

        <Field label="Sản phẩm">
          {data.products.length === 0 ? (
            <p className="text-stone-500">Chưa có sản phẩm cà phê đóng gói nào đang bán.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.products.map((p) => (
                <Chip key={p.id} selected={draft.productId === p.id} onClick={() => selectProduct(p.id)}>
                  {p.name}
                </Chip>
              ))}
            </div>
          )}
          {product && variant && (
            <VariantPicker variants={product.variants} selected={variant} onSelect={(v) => set({ variantId: v.id })} />
          )}
        </Field>

        <Field label={byWeight || !variant ? "Số lượng (kg)" : `Số lượng (${variant.unit ?? "cái"})`}>
          <div className="flex flex-wrap items-center gap-2">
            {QTY_PRESETS.map((n) => (
              <Chip key={n} selected={draft.amount === n} onClick={() => set({ amount: n })} className="min-w-12">
                {n}
              </Chip>
            ))}
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              aria-label="Số lượng khác"
              placeholder="Khác"
              value={draft.amount != null && !QTY_PRESETS.includes(draft.amount) ? draft.amount : ""}
              onChange={(e) => set({ amount: e.target.value === "" ? null : Number(e.target.value) })}
              className="h-11 w-24 rounded-full border border-stone-200 bg-white px-4 font-semibold outline-none focus:border-moss-500"
            />
          </div>
          {variant && quantity ? (
            <p className="mt-2 text-[15px] text-stone-500">
              {byWeight && `${quantity} túi × `}
              {formatVnd(unitPrice)}
              {draft.customerId && customerPrices[variant.id] != null && " (giá riêng)"} ={" "}
              <b className="text-stone-900">{formatVnd(total)}</b>
            </p>
          ) : null}
        </Field>

        <DateField value={draft.deliveryDate} onChange={(deliveryDate) => set({ deliveryDate })} />

        <Field label="Thanh toán">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PAYMENT_LABEL) as PaymentChoice[]).map((p) => (
              <Chip key={p} selected={draft.payment === p} onClick={() => set({ payment: p })}>
                {PAYMENT_LABEL[p]}
              </Chip>
            ))}
          </div>
          {draft.payment === "partial" && (
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              placeholder="Số tiền đã trả"
              value={draft.paidAmount ?? ""}
              onChange={(e) => set({ paidAmount: e.target.value === "" ? null : Number(e.target.value) })}
              className="mt-3 h-12 w-full rounded-xl border border-stone-200 bg-white px-4 text-lg font-semibold outline-none focus:border-moss-500"
            />
          )}
          {draft.payment !== "unpaid" && (
            <div className="mt-3 flex gap-2">
              {PAYMENT_METHODS.map((m) => (
                <Chip key={m} selected={draft.payMethod === m} onClick={() => set({ payMethod: m })}>
                  {m}
                </Chip>
              ))}
            </div>
          )}
        </Field>

        <Field label="Ghi chú">
          <input
            value={draft.note}
            onChange={(e) => set({ note: e.target.value })}
            placeholder="Xay phin, giao buổi sáng…"
            className="h-12 w-full rounded-xl border border-stone-200 bg-white px-4 outline-none focus:border-moss-500"
          />
        </Field>
      </div>
      <ActionBar>
        <button
          type="button"
          onClick={() => setStep("confirm")}
          disabled={problems.length > 0}
          className="h-14 w-full rounded-2xl bg-moss-700 text-lg font-extrabold text-white active:bg-moss-800 disabled:bg-stone-300 disabled:text-stone-600"
        >
          {problems[0] ?? "TIẾP TỤC"}
        </button>
      </ActionBar>
    </>
  );
}

function VariantPicker({
  variants,
  selected,
  onSelect,
}: {
  variants: QuickVariant[];
  selected: QuickVariant;
  onSelect(v: QuickVariant): void;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div className="mt-3 flex items-center justify-between rounded-xl bg-moss-50 px-4 py-2.5">
        <span className="font-semibold">{variantLabel(selected)}</span>
        {variants.length > 1 && (
          <button type="button" onClick={() => setOpen(true)} className="h-9 rounded-lg px-2 font-bold text-moss-700 active:bg-moss-100">
            Đổi quy cách
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-moss-50 p-3">
      {variants.map((v) => (
        <Chip
          key={v.id}
          selected={v.id === selected.id}
          onClick={() => {
            onSelect(v);
            setOpen(false);
          }}
        >
          {variantLabel(v)}
        </Chip>
      ))}
    </div>
  );
}
