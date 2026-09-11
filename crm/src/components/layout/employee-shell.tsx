"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, Wrench, FileText, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/my-tasks", label: "Việc của tôi", icon: Home },
  { href: "/my-orders", label: "Đơn hàng", icon: Package },
  { href: "/my-installations", label: "Lắp đặt", icon: Wrench },
  { href: "/my-protocols", label: "Biên bản", icon: FileText },
  { href: "/notifications", label: "Thông báo", icon: Bell },
  { href: "/profile", label: "Cá nhân", icon: User },
];

export function EmployeeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <main className="flex-1 pb-20">{children}</main>

      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-30 border-t border-stone-200 bg-white">
        <div className="mx-auto flex max-w-md">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs",
                  active ? "text-amber-800" : "text-stone-500"
                )}
              >
                <Icon className={cn("h-6 w-6", active && "fill-amber-100")} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
