import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { QuickNav } from "@/components/quick/quick-nav";
import { LogoutButton } from "@/components/layout/logout-button";

// Lối vào toàn bộ CRM từ TÚ QUICK — các màn này dùng giao diện CRM đầy đủ.
const LINKS = [
  { href: "/dashboard", label: "Dashboard CRM" },
  { href: "/orders", label: "Tất cả đơn hàng" },
  { href: "/orders/new", label: "Tạo đơn cà phê (đầy đủ)" },
  { href: "/orders/new-equipment", label: "Tạo đơn thiết bị" },
  { href: "/bao-gia", label: "Báo giá" },
  { href: "/inventory", label: "Kho & rang" },
  { href: "/products", label: "Sản phẩm" },
  { href: "/cash", label: "Thu / Chi" },
];

export default function QuickMorePage() {
  return (
    <div className="pb-quick-nav">
      <header className="flex h-14 items-center border-b border-stone-200 px-5">
        <h1 className="text-lg font-bold">Thêm</h1>
      </header>
      <ul className="mt-4 border-y border-stone-200 bg-white">
        {LINKS.map((l) => (
          <li key={l.href} className="border-b border-stone-200 last:border-b-0">
            <Link href={l.href} className="flex h-14 items-center justify-between px-5 text-[17px] font-semibold active:bg-moss-50">
              {l.label}
              <ChevronRight className="h-5 w-5 text-stone-400" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="px-5 pt-6">
        <LogoutButton />
      </div>
      <QuickNav />
    </div>
  );
}
