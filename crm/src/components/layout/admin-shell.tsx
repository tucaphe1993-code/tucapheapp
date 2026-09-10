"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    label: "Tổng quan",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Vận hành",
    items: [
      { href: "/orders", label: "Đơn hàng", icon: ClipboardList },
      { href: "/orders/new", label: "Tạo đơn", icon: PlusCircle },
      { href: "/tasks", label: "Công việc", icon: ListChecks },
    ],
  },
  {
    label: "Danh mục",
    items: [
      { href: "/products", label: "Sản phẩm", icon: Coffee },
      { href: "/inventory", label: "Kho", icon: Boxes },
    ],
  },
  {
    label: "Khách hàng",
    items: [{ href: "/customers", label: "Khách hàng", icon: Users }],
  },
  {
    label: "Hệ thống",
    items: [
      { href: "/users", label: "Nhân viên", icon: UserCog },
      { href: "/audit-logs", label: "Nhật ký", icon: ScrollText },
    ],
  },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1]?.[0] ?? "";
  const first = parts[0]?.[0] ?? "";
  return (first + last).toUpperCase();
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <div className="px-3 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
            {group.label}
          </div>
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-amber-50 text-amber-900"
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-amber-800" : "text-stone-400")} />
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function ProfileChip({ fullName }: { fullName: string }) {
  const router = useRouter();

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-stone-200/70 bg-stone-50 p-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-800 text-xs font-bold text-white">
        {initials(fullName)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-stone-900">{fullName}</div>
        <div className="text-xs text-stone-500">Quản lý</div>
      </div>
      <button
        onClick={onLogout}
        aria-label="Đăng xuất"
        className="rounded-lg p-2 text-stone-400 hover:bg-white hover:text-stone-700"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
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
    <div className="flex min-h-screen bg-stone-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-stone-200/70 bg-white p-4 md:flex md:flex-col">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-800 text-lg">
            ☕
          </span>
          <div>
            <div className="text-sm font-bold leading-tight text-stone-900">Tú Cà Phê</div>
            <div className="text-xs text-stone-500 leading-tight">CRM Quản lý</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks pathname={pathname} />
        </div>
        <div className="pt-3">
          <ProfileChip fullName={fullName} />
        </div>
      </aside>

      {/* Mobile header + drawer */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-stone-200/70 bg-white px-4 py-3 md:hidden">
          <button onClick={() => setOpen(true)} aria-label="Mở menu">
            <Menu className="h-6 w-6" />
          </button>
          <div className="text-sm font-bold">Tú Cà Phê CRM</div>
          <div className="w-6" />
        </header>

        {open && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-0 flex h-full w-72 flex-col bg-white p-4 shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-800 text-lg">
                    ☕
                  </span>
                  <div className="text-sm font-bold">Tú Cà Phê CRM</div>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Đóng menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
              </div>
              <div className="pt-3">
                <ProfileChip fullName={fullName} />
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
