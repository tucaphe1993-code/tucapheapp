"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  ListChecks,
  Users,
  Coffee,
  Boxes,
  UserCog,
  ScrollText,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/layout/logout-button";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Đơn hàng", icon: ClipboardList },
  { href: "/orders/new", label: "Tạo đơn", icon: PlusCircle },
  { href: "/tasks", label: "Công việc", icon: ListChecks },
  { href: "/customers", label: "Khách hàng", icon: Users },
  { href: "/products", label: "Sản phẩm", icon: Coffee },
  { href: "/inventory", label: "Kho", icon: Boxes },
  { href: "/users", label: "Nhân viên", icon: UserCog },
  { href: "/audit-logs", label: "Nhật ký", icon: ScrollText },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
              active ? "bg-amber-800 text-white" : "text-stone-700 hover:bg-stone-100"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({
  fullName,
  children,
}: {
  fullName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-stone-200 bg-white p-4 md:flex md:flex-col">
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="text-2xl">☕</span>
          <div>
            <div className="text-sm font-bold leading-tight">Tú Cà Phê</div>
            <div className="text-xs text-stone-500 leading-tight">CRM Quản lý</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks pathname={pathname} />
        </div>
        <div className="border-t border-stone-200 pt-3">
          <div className="px-3 pb-2 text-xs text-stone-500">Đăng nhập: {fullName}</div>
          <LogoutButton />
        </div>
      </aside>

      {/* Mobile header + drawer */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 md:hidden">
          <button onClick={() => setOpen(true)} aria-label="Mở menu">
            <Menu className="h-6 w-6" />
          </button>
          <div className="text-sm font-bold">Tú Cà Phê CRM</div>
          <div className="w-6" />
        </header>

        {open && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-72 bg-white p-4 shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">☕</span>
                  <div className="text-sm font-bold">Tú Cà Phê CRM</div>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Đóng menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
              <div className="mt-6 border-t border-stone-200 pt-3">
                <div className="px-3 pb-2 text-xs text-stone-500">Đăng nhập: {fullName}</div>
                <LogoutButton />
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-x-hidden bg-stone-50 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
