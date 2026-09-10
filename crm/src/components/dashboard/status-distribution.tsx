import { ORDER_STATUS_LABEL } from "@/components/orders/order-status-badge";
import type { OrderStatus } from "@/types/db";

const STATUS_COLOR: Record<OrderStatus, string> = {
  DRAFT: "#a8a29e",
  CONFIRMED: "#3b82f6",
  PACKING: "#f59e0b",
  PACKED: "#d97706",
  SHIPPED: "#6366f1",
  COMPLETED: "#10b981",
  CANCELLED: "#ef4444",
};

export interface StatusCount {
  status: OrderStatus;
  count: number;
}

export function StatusDistribution({ data }: { data: StatusCount[] }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const nonZero = data.filter((d) => d.count > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
        {nonZero.map((d) => (
          <div
            key={d.status}
            style={{ width: `${(d.count / total) * 100}%`, backgroundColor: STATUS_COLOR[d.status] }}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        {nonZero.map((d) => (
          <div key={d.status} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_COLOR[d.status] }}
              />
              <span className="text-stone-600">{ORDER_STATUS_LABEL[d.status]}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-stone-900">{d.count}</span>
              <span className="w-10 text-right text-xs text-stone-400">
                {Math.round((d.count / total) * 100)}%
              </span>
            </div>
          </div>
        ))}
        {nonZero.length === 0 && (
          <div className="py-4 text-center text-sm text-stone-400">Chưa có đơn hàng</div>
        )}
      </div>
    </div>
  );
}
