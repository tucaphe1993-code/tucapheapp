import Link from "next/link";
import { formatVnd } from "@/lib/utils";
import type { TopProductItem, TopProductCategory } from "@/lib/services/dashboard";

const TAB_LABEL: Record<TopProductCategory, string> = {
  ALL: "Tất cả",
  COFFEE: "Cà phê",
  OTHER: "Thiết bị",
};

export function TopProductsCard({
  items,
  tabs,
}: {
  items: TopProductItem[];
  tabs: { value: TopProductCategory; href: string; active: boolean }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={t.href}
            scroll={false}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              t.active ? "bg-amber-800 text-white" : "bg-white text-stone-600 border border-stone-200"
            }`}
          >
            {TAB_LABEL[t.value]}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="py-6 text-center text-sm text-stone-400">Chưa có dữ liệu</div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item, idx) => (
            <div key={item.variantId} className="flex items-center gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-500">
                {idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-stone-800">{item.label}</div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-amber-700" style={{ width: `${item.share}%` }} />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold text-stone-900">{formatVnd(item.revenue)}</div>
                <div className="text-xs text-stone-400">{item.quantity} bán ra</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
