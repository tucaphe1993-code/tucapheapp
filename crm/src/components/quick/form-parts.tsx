"use client";

// Mảnh form dùng chung cho Ghi đơn nhanh và Công việc (TÚ QUICK).
import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { addDays, normalizeName } from "@/lib/quick";
import type { QuickCustomer } from "@/lib/services/quick";
import { Chip } from "./chip";
import { useToday } from "./use-today";

export async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Có lỗi xảy ra");
  return data;
}

export function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-stone-200 bg-[#fafaf6]/95 px-2 backdrop-blur">
      <button type="button" onClick={onBack} aria-label="Quay lại" className="grid h-11 w-11 place-items-center rounded-full active:bg-moss-50">
        <ChevronLeft className="h-6 w-6" />
      </button>
      <h1 className="text-lg font-bold">{title}</h1>
    </header>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="px-5 pt-5">
      <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-stone-500">{label}</h2>
      {children}
    </section>
  );
}

export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="h-28" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-md gap-3 px-5 py-3">{children}</div>
      </div>
    </>
  );
}

export function DateField({
  value,
  onChange,
  label = "Ngày giao",
}: {
  value: string | null;
  onChange(v: string | null): void;
  label?: string;
}) {
  const today = useToday();
  if (!today) return <Field label={label}>{null}</Field>;
  const chips = [
    { label: "Hôm nay", value: today },
    { label: "Ngày mai", value: addDays(today, 1) },
    { label: "Ngày kia", value: addDays(today, 2) },
    { label: "Không hẹn", value: null },
  ];
  const custom = value && !chips.some((c) => c.value === value);
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <Chip key={c.label} selected={value === c.value} onClick={() => onChange(c.value)}>
            {c.label}
          </Chip>
        ))}
        <input
          type="date"
          aria-label="Chọn ngày giao"
          value={custom ? value! : ""}
          min={today}
          onChange={(e) => onChange(e.target.value || null)}
          className={`h-11 rounded-full border px-4 font-semibold outline-none ${
            custom ? "border-moss-700 bg-moss-700 text-white" : "border-stone-200 bg-white"
          }`}
        />
      </div>
    </Field>
  );
}

export function CustomerPicker({
  customers,
  selected,
  newName,
  onChange,
}: {
  customers: QuickCustomer[];
  selected: QuickCustomer | null;
  newName: string | null;
  onChange(v: { customerId: string | null; newCustomerName: string | null }): void;
}) {
  const [query, setQuery] = useState("");

  // Khách đặt gần nhất lên đầu.
  const recent = useMemo(
    () => [...customers].sort((a, b) => (b.last_order_at ?? "").localeCompare(a.last_order_at ?? "") || a.name.localeCompare(b.name, "vi")),
    [customers]
  );
  const q = normalizeName(query);
  const matches = q
    ? recent.filter((c) => normalizeName(c.name).includes(q) || (c.phone ?? "").includes(q) || (c.code ?? "").toLowerCase().includes(q))
    : recent.slice(0, 8);
  const exact = q ? customers.find((c) => normalizeName(c.name) === q) : undefined;

  if (selected || newName) {
    return (
      <div className="flex items-center gap-3 rounded-xl border-2 border-moss-600 bg-moss-50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{selected?.name ?? newName}</p>
          <p className="text-sm text-stone-500">
            {selected ? [selected.code, selected.phone].filter(Boolean).join(" · ") : <b className="text-moss-700">Khách mới</b>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            onChange({ customerId: null, newCustomerName: null });
          }}
          className="h-10 rounded-lg px-3 font-semibold text-moss-700 active:bg-moss-100"
        >
          Đổi
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Gõ tên, SĐT hoặc mã khách…"
        enterKeyHint="done"
        className="h-13 w-full rounded-xl border border-stone-200 bg-white px-4 text-lg outline-none focus:border-moss-500"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {matches.map((c) => (
          <button
            type="button"
            key={c.id}
            onClick={() => onChange({ customerId: c.id, newCustomerName: null })}
            className="h-11 rounded-full border border-stone-200 bg-white px-4 text-[15px] font-semibold active:bg-moss-50"
          >
            {c.name}
          </button>
        ))}
        {query.trim() && !exact && (
          <button
            type="button"
            onClick={() => onChange({ customerId: null, newCustomerName: query.trim() })}
            className="h-11 rounded-full border-2 border-dashed border-moss-500 px-4 text-[15px] font-bold text-moss-700 active:bg-moss-50"
          >
            + Thêm khách mới “{query.trim()}”
          </button>
        )}
      </div>
    </div>
  );
}
