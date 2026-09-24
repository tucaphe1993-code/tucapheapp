"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, ClipboardPlus, Mic, Phone } from "lucide-react";
import { ORDER_STATUS_LABEL } from "@/components/orders/order-status-badge";
import {
  daysLate,
  deliveryKey,
  dueSummary,
  formatDayMonth,
  isOverdue,
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
import type { QuickHomeData, QuickJob, QuickOrder } from "@/lib/services/quick";
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
  const jobs = useMemo(
    () => (today ? sortForList(data.jobs.filter((j) => matchesFilter(j, filter, today))) : []),
    [data.jobs, filter, today]
  );
  const filterLabel = QUICK_FILTERS.find((f) => f.key === filter)!.label;
  const due = today ? { orders: dueSummary(data.orders, today), jobs: dueSummary(data.jobs, today) } : null;

  function showToday() {
    setFilter("today");
    document.getElementById("quick-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="pb-quick-nav">
      <header className="px-5 pt-6 text-center">
        <h1 className="text-[28px] font-extrabold tracking-tight text-moss-800">TÚ QUICK</h1>
        <p className="text-[15px] text-stone-500">Ghi đơn • Theo dõi • Công nợ</p>
      </header>

      {due && <DueBanner orders={due.orders} jobs={due.jobs} onOpen={showToday} />}

      <div className="px-5 pt-5">
        <Link
          href="/quick/new"
          className="flex h-32 w-full flex-col items-center justify-center gap-1 rounded-3xl bg-moss-700 text-white shadow-lg shadow-moss-700/25 active:scale-[0.98] active:bg-moss-800"
        >
          <Mic className="h-10 w-10" strokeWidth={2.2} />
          <span className="text-2xl font-extrabold tracking-wide">GHI NHANH</span>
        </Link>
        <Link
          href="/quick/jobs/new"
          className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-moss-600 bg-white text-lg font-bold text-moss-700 active:bg-moss-50"
        >
          <ClipboardPlus className="h-6 w-6" />
          Thêm công việc
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

      <div id="quick-list" className="mt-6 flex scroll-mt-2 gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {QUICK_FILTERS.map((f) => (
          <Chip key={f.key} selected={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </Chip>
        ))}
      </div>

      <section className="mt-3">
        {today && list.length === 0 && jobs.length === 0 ? (
          <p className="px-5 py-10 text-center text-stone-500">Không có đơn hay việc nào — {filterLabel.toLowerCase()}.</p>
        ) : (
          <>
            {jobs.length > 0 && (
              <>
                <ListLabel>Công việc ({jobs.length})</ListLabel>
                <ul className="border-y border-stone-200">
                  {jobs.map((j) => (
                    <JobRow key={j.id} job={j} today={today!} />
                  ))}
                </ul>
              </>
            )}
            {list.length > 0 && (
              <>
                {jobs.length > 0 && <ListLabel>Đơn hàng ({list.length})</ListLabel>}
                <ul className="border-y border-stone-200">
                  {list.map((o) => (
                    <OrderRow key={o.id} order={o} today={today!} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
        {filter === "done" && (
          <p className="px-5 pt-3 text-center text-[13px] text-stone-400">Đã hoàn thành trong 35 ngày gần nhất</p>
        )}
      </section>
    </div>
  );
}

function ListLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="px-5 pb-2 pt-4 text-[13px] font-bold uppercase tracking-wide text-stone-500">{children}</h2>;
}

type Due = { dueToday: number; overdue: number };

/** Nhắc việc khi mở app (Phase 4 — cách A): đơn/việc cần xử lý hôm nay + trễ hạn. */
function DueBanner({ orders, jobs, onOpen }: { orders: Due; jobs: Due; onOpen(): void }) {
  const overdueParts = [
    orders.overdue > 0 && `${orders.overdue} đơn`,
    jobs.overdue > 0 && `${jobs.overdue} việc`,
  ].filter(Boolean);
  const todayParts = [
    orders.dueToday > 0 && `${orders.dueToday} đơn cần xử lý`,
    jobs.dueToday > 0 && `${jobs.dueToday} việc hẹn`,
  ].filter(Boolean);
  if (!todayParts.length && !overdueParts.length) {
    return <p className="px-5 pt-3 text-center text-[15px] font-semibold text-moss-700">✓ Hôm nay chưa có đơn hay việc hẹn</p>;
  }
  const dueToday = todayParts.length;
  const overdue = overdueParts.length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`mx-5 mt-4 flex w-[calc(100%-2.5rem)] items-center gap-3 rounded-2xl px-4 py-3 text-left active:scale-[0.99] ${
        overdue > 0 ? "bg-red-50 text-red-900 ring-2 ring-red-200" : "bg-amber-50 text-amber-900 ring-2 ring-amber-200"
      }`}
    >
      <AlertTriangle className={`h-7 w-7 shrink-0 ${overdue > 0 ? "text-red-600" : "text-amber-600"}`} />
      <span className="flex-1">
        {dueToday > 0 && (
          <span className="block text-[17px] font-extrabold uppercase">Hôm nay có {todayParts.join(" · ")}</span>
        )}
        {overdue > 0 && (
          <span className={`block font-bold text-red-700 ${dueToday > 0 ? "text-[15px]" : "text-[17px] uppercase"}`}>
            Trễ hạn chưa xong: {overdueParts.join(", ")}
          </span>
        )}
      </span>
      <span className="text-sm font-bold underline">Xem</span>
    </button>
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
  const late = isOverdue(order, today) ? daysLate(delivery!, today) : 0;
  const remaining = order.total_amount - order.paid_amount;

  async function runAction() {
    if (!action) return;
    if (action.confirm && !window.confirm(action.confirm)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/${action.path}`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "Có lỗi xảy ra");
        return;
      }
      toast.success(`${order.customer_name}: ${action.label.toLowerCase()} ✓`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center gap-2 border-b border-stone-200 bg-white pr-4 last:border-b-0">
      <Link href={`/orders/${order.id}`} className="min-w-0 flex-1 py-3 pl-5">
        <p className={`truncate text-[17px] font-bold ${open ? "" : "text-stone-400 line-through decoration-1"}`}>
          {order.customer_name} — {qty}
        </p>
        <p className="truncate text-[15px] text-stone-500">
          {products}
          {delivery && !late && <> · Giao {relativeDayLabel(delivery, today).toLowerCase()}</>}
        </p>
        {late > 0 && (
          <p className="text-[13px] font-bold text-red-700">
            ⚠ Trễ {late} ngày (hẹn giao {formatDayMonth(delivery!)})
          </p>
        )}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-bold ${STATUS_STYLE[order.status]}`}>
            {ORDER_STATUS_LABEL[order.status]}
          </span>
          {remaining > 0 && order.status !== "CANCELLED" && (
            <span className="text-[13px] font-semibold text-red-700">Còn nợ {formatVnd(remaining)}</span>
          )}
        </p>
      </Link>
      {action ? (
        <button
          type="button"
          onClick={() => void runAction()}
          disabled={busy}
          className={`h-11 shrink-0 rounded-xl px-4 text-[15px] font-extrabold disabled:opacity-60 ${
            action.path === "deliver"
              ? "bg-moss-700 text-white active:bg-moss-800"
              : "border-2 border-moss-600 bg-white text-moss-700 active:bg-moss-50"
          }`}
        >
          {busy ? "…" : action.label}
        </button>
      ) : order.status === "COMPLETED" ? (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-moss-600 text-white" aria-label="Hoàn thành">
          <Check className="h-5 w-5" strokeWidth={3} />
        </span>
      ) : null}
    </li>
  );
}

/** 1 dòng công việc: ô tròn = đánh dấu xong (có Hoàn tác), bấm dòng = sửa. */
function JobRow({ job, today }: { job: QuickJob; today: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const done = job.status === "DONE";
  const date = deliveryKey(job.due_date);
  const late = isOverdue(job, today) ? daysLate(date!, today) : 0;

  async function setStatus(status: QuickJob["status"]) {
    const res = await fetch(`/api/quick-jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Có lỗi xảy ra");
    router.refresh();
  }

  async function toggle() {
    const next = done ? "OPEN" : "DONE";
    setBusy(true);
    try {
      await setStatus(next);
      toast.success(next === "DONE" ? `Xong: ${job.title} ✓` : `Mở lại: ${job.title}`, {
        action: { label: "Hoàn tác", onClick: () => void setStatus(job.status).catch((e) => toast.error((e as Error).message)) },
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center border-b border-stone-200 bg-white last:border-b-0">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy || job.status === "CANCELLED"}
        aria-label={done ? "Mở lại việc" : "Đánh dấu xong"}
        className="grid h-[72px] w-16 shrink-0 place-items-center"
      >
        <span
          className={`grid h-9 w-9 place-items-center rounded-lg border-2 ${
            done ? "border-moss-600 bg-moss-600 text-white" : "border-moss-500 active:bg-moss-100"
          } ${busy ? "animate-pulse" : ""}`}
        >
          {done && <Check className="h-5 w-5" strokeWidth={3} />}
        </span>
      </button>
      <Link href={`/quick/jobs/${job.id}`} className="min-w-0 flex-1 py-3 pr-2">
        <p className={`truncate text-[17px] font-bold ${done ? "text-stone-400 line-through decoration-1" : ""}`}>
          {job.title}
          {job.customer_name && <> — {job.customer_name}</>}
        </p>
        {late > 0 ? (
          <p className="text-[13px] font-bold text-red-700">
            ⚠ Trễ {late} ngày (hẹn {formatDayMonth(date!)})
          </p>
        ) : (
          <p className="truncate text-[15px] text-stone-500">
            {date ? `Hẹn ${relativeDayLabel(date, today).toLowerCase()}` : "Không hẹn ngày"}
            {job.note && <> · {job.note}</>}
          </p>
        )}
      </Link>
      {job.customer_phone && !done && (
        <a
          href={`tel:${job.customer_phone}`}
          aria-label={`Gọi ${job.customer_name}`}
          className="mr-3 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-moss-50 text-moss-700 active:bg-moss-100"
        >
          <Phone className="h-5 w-5" />
        </a>
      )}
    </li>
  );
}
