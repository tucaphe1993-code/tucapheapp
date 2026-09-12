import Link from "next/link";
import type { OrderStatusBuckets as OrderStatusBucketsData } from "@/lib/services/dashboard";

const BUCKETS: {
  key: "confirmed" | "packing" | "shipped" | "cancelled";
  label: string;
  color: string;
  href: string;
}[] = [
  { key: "confirmed", label: "Đã xác nhận", color: "#3b82f6", href: "/orders?status=CONFIRMED" },
  { key: "packing", label: "Đang đóng gói", color: "#f59e0b", href: "/orders?status=PACKING" },
  { key: "shipped", label: "Đã giao", color: "#10b981", href: "/orders?status=SHIPPED" },
  { key: "cancelled", label: "Đã hủy", color: "#ef4444", href: "/orders?status=CANCELLED" },
];

export function OrderStatusBuckets({ data }: { data: OrderStatusBucketsData }) {
  if (data.total === 0) {
    return <div className="py-6 text-center text-sm text-stone-400">Chưa có đơn hàng</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
        {BUCKETS.map((b) => {
          const count = data[b.key];
          if (count === 0) return null;
          return (
            <div key={b.key} style={{ width: `${(count / data.total) * 100}%`, backgroundColor: b.color }} />
          );
        })}
      </div>
      <div className="flex flex-col gap-1">
        {BUCKETS.map((b) => {
          const count = data[b.key];
          return (
            <Link
              key={b.key}
              href={b.href}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-stone-50"
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: b.color }} />
                <span className="text-stone-600">{b.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-stone-900">{count}</span>
                <span className="w-10 text-right text-xs text-stone-400">
                  {Math.round((count / data.total) * 100)}%
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
