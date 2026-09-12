import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionCenterItem {
  key: string;
  icon: LucideIcon;
  count: number;
  label: string;
  href: string;
  severity: "high" | "medium";
}

export function ActionCenter({ items }: { items: ActionCenterItem[] }) {
  const visible = items.filter((i) => i.count > 0);

  if (visible.length === 0) {
    return <div className="py-6 text-center text-sm text-stone-500">🎉 Không có việc gì cần xử lý gấp</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      {visible.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className="flex items-center gap-3 rounded-lg border border-stone-200 p-3 text-sm transition-colors hover:border-amber-300"
        >
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              item.severity === "high" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
            )}
          >
            <item.icon className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <span className="font-semibold text-stone-900">{item.count}</span>{" "}
            <span className="text-stone-600">{item.label}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
