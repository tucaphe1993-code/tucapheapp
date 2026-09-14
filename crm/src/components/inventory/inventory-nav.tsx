import Link from "next/link";

const TABS = [
  { href: "/inventory", label: "Tổng quan" },
  { href: "/inventory/stock", label: "Tồn kho" },
  { href: "/inventory/roasting", label: "Rang / Sản xuất" },
  { href: "/inventory/count", label: "Kiểm kê" },
  { href: "/inventory/transactions", label: "Lịch sử giao dịch" },
  { href: "/devices", label: "Máy & Serial" },
] as const;

export function InventoryNav({ active }: { active: string }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
            active === t.href
              ? "bg-amber-800 text-white"
              : "bg-white text-stone-600 border border-stone-200"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
