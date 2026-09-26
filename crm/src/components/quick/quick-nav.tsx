"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis, ListChecks, Users, Wallet } from "lucide-react";

// Công nợ / Khách hàng dùng thẳng trang CRM có sẵn (cùng dữ liệu, không làm lại).
const TABS = [
  { href: "/quick", label: "Đơn hàng", Icon: ListChecks },
  { href: "/debts", label: "Công nợ", Icon: Wallet },
  { href: "/customers", label: "Khách hàng", Icon: Users },
  { href: "/quick/more", label: "Thêm", Icon: Ellipsis },
];

export function QuickNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-md">
        {TABS.map(({ href, label, Icon }) => {
          const on = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold ${
                  on ? "text-moss-700" : "text-stone-500"
                }`}
              >
                <Icon className="h-6 w-6" strokeWidth={on ? 2.4 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
