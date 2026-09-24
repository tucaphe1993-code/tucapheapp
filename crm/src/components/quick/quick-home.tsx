"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Mic } from "lucide-react";
import { ORDER_STATUS_LABEL } from "@/components/orders/order-status-badge";
import {
  deliveryKey,
  isOpenStatus,
  matchesFilter,
  nextAction,
  PENDING_STATUSES,
  QUICK_FILTERS,
  relativeDayLabel,
  sortForList,
  totalKg,
  type QuickFilter,
} from "@/lib/quick";
import type { QuickHomeData, QuickOrder } from "@/lib/services/quick";
import { formatKg, formatVnd } from "@/lib/utils";
import type { OrderStatus } from "@/types/db";
import { Chip } from "./chip";
import { useToday } from "./use-today";

const STATUS_STYLE: Record<OrderStatus, string> = {
  DRAFT: "bg-stone-100 text-stone-600",
  CONFIRMED: "bg-amber-100 text-amber-900",
  PACKING: "bg-orange-100 text-orange-900",
  PACKED: "bg-sky-100 text-sky-900",
  SHIPPED: "bg-indigo-100 text-indigo-900",
  COMPLETED: "bg-moss-100 text-moss-800",
  CANCELLED: "bg-stone-200 text-stone-500",
};

export function QuickHome({ data }: { data: QuickHomeData }) {
  // "Hôm nay" phải theo giờ điện thoại (máy chủ chạy giờ UTC) → tính ở client.
  const today = useToday();
  const [filter, setFilter] = useState<QuickFilter>("today");

  const pendingCount = data.orders.filter((o) => PENDING_STATUSES.includes(o.status)).length;
  const list = useMemo(
    () => (today ? sortForList(data.orders.filter((o) => matchesFilter(o, filter, today))) : []),
    [data.orders, filter, today]
  );
  const filterLabel = QUICK_FILTERS.find((f) => f.key === filter)!.label;

  return (
    <div className="pb-quick-nav">
      <header className="px-5 pt-6 text-center">
        <h1 className="text-[28px] font-extrabold tracking-tight text-moss-800">TÚ QUICK</h1>
        <p className="text-[15px] text-stone-500">Ghi đơn • Theo dõi • Công nợ</p>
      </header>

      <div className="px-5 pt-5">
        <Link
          href="/quick/new"
          className="flex h-32 w-full flex-col items-center justify-center gap-1 rounded-3xl bg-moss-700 text-white shadow-lg shadow-moss-700/25 active:scale-[0.98] active:bg-moss-800"
        >
          <Mic className="h-10 w-10" strokeWidth={2.2} />
          <span className="text-2xl font-extrabold tracking-wide">GHI NHANH</span>
        </Link>
      </div>

      <nav className="mx-5 mt-5 grid grid-cols-3 divide-x divide-stone-200 rounded-2xl border border-stone-200 bg-white text-center">
        <button type="button" onClick={() => setFilter("open")} className="py-3">
          <span className="block text-2xl font-extrabold text-moss-800">{pendingCount}</span>
          <span className="text-[13px] text-stone-500">Chưa xử lý</span>
        </button>
        <Link href="/debts" className="px-1 py-3">
          <span className="block truncate text-lg font-extrabold leading-8 text-moss-800">{formatShortVnd(data.receivable)}</span>
          <span className="text-[13px] text-stone-500">Công nợ</span>
        </Link>
        <Link href="/customers" className="py-3">
          <span className="block text-2xl font-extrabold text-moss-800">{data.customerCount}</span>
          <span className="text-[13px] text-stone-500">Khách hàng</span>
        </Link>
      </nav>

      <div className="mt-6 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {QUICK_FILTERS.map((f) => (
          <Chip key={f.key} selected={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </Chip>
        ))}
      </div>

      <section className="mt-3">
        {today && list.length === 0 ? (
          <p className="px-5 py-10 text-center text-stone-500">Không có đơn nào — {filterLabel.toLowerCase()}.</p>
        ) : (
          <ul className="border-y border-stone-200">
            {list.map((o) => (
              <OrderRow key={o.id} order={o} today={today!} />
            ))}
          </ul>
        )}
        {filter === "done" && <p className="px-5 pt-3 text-center text-[13px] text-stone-400">Đơn hoàn thành trong 35 ngày gần nhất</p>}
      </section>
    </div>
  );
}

/** 5.200.000 → "5,2tr" cho ô tổng công nợ nhỏ. */
function formatShortVnd(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return formatVnd(n);
}

function summarize(order: QuickOrder): { qty: string; products: string } {
  const kg = totalKg(order.items);
  const names = [...new Set(order.items.map((i) => i.product_name))];
  const qty = kg > 0 ? formatKg(kg) : `${order.items.reduce((s, i) => s + i.quantity, 0)} món`;
  return { qty, products: names.length > 1 ? `${names[0]} +${names.length - 1}` : (names[0] ?? "—") };
}

function OrderRow({ order, today }: { order: QuickOrder; today: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const action = nextAction(order.status);
  const open = isOpenStatus(order.status);
  const { qty, products } = summarize(order);
  const delivery = deliveryKey(order.delivery_date);
  const remaining = order.total_amount - order.paid_amount;

  async function runAction() {
    if (!action) return;
    if (action.kind === "open") {
      router.push(`/orders/${order.id}`);
      return;
    }
    if (action.confirm && !window.confirm(action.confirm)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/${action.path}`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "Có lỗi xảy ra");
        return;
      }
      toast.success(`${order.order_code}: ${action.label.toLowerCase()} ✓`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center border-b border-stone-200 bg-white last:border-b-0">
      <button
        type="button"
        onClick={() => void runAction()}
        disabled={!action || busy}
        aria-label={action?.label ?? ORDER_STATUS_LABEL[order.status]}
        className="flex h-[76px] w-16 shrink-0 flex-col items-center justify-center gap-0.5"
      >
        <span
          className={`grid h-9 w-9 place-items-center rounded-full border-2 ${
            order.status === "COMPLETED"
              ? "border-moss-600 bg-moss-600 text-white"
              : open
                ? "border-moss-500 text-moss-600 active:bg-moss-100"
                : "border-stone-300"
          } ${busy ? "animate-pulse" : ""}`}
        >
          {order.status === "COMPLETED" && <Check className="h-5 w-5" strokeWidth={3} />}
        </span>
        {action && <span className="text-[10px] font-bold leading-none text-moss-700">{action.label}</span>}
      </button>
      <Link href={`/orders/${order.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-4">
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[17px] font-bold ${open ? "" : "text-stone-400 line-through decoration-1"}`}>
            {order.customer_name} — {qty}
          </p>
          <p className="truncate text-[15px] text-stone-500">
            {products}
            {delivery && <> · Giao {relativeDayLabel(delivery, today).toLowerCase()}</>}
          </p>
          {remaining > 0 && order.status !== "CANCELLED" && (
            <p className="text-[13px] font-semibold text-red-700">Còn nợ {formatVnd(remaining)}</p>
          )}
        </div>
        <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-bold ${STATUS_STYLE[order.status]}`}>
          {ORDER_STATUS_LABEL[order.status]}
        </span>
      </Link>
    </li>
  );
}
