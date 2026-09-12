import Link from "next/link";

export function CoffeeStockCard({ finishedKg, lowStockCount }: { finishedKg: number; lowStockCount: number }) {
  return (
    <div className="flex flex-col gap-2.5 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-stone-500">Cà phê thành phẩm (đã đóng gói)</span>
        <span className="font-semibold text-stone-900">
          {finishedKg.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} kg
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-stone-500">Cà phê nhân xanh</span>
        <span className="text-stone-400 italic">Chưa có dữ liệu</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-stone-500">Sản lượng có thể sản xuất</span>
        <span className="text-stone-400 italic">Chưa có dữ liệu</span>
      </div>
      <Link
        href="/inventory"
        className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-stone-50"
      >
        <span className="text-stone-500">SKU cà phê sắp hết</span>
        <span className={lowStockCount > 0 ? "font-semibold text-amber-700" : "font-semibold text-stone-900"}>
          {lowStockCount}
        </span>
      </Link>
    </div>
  );
}
