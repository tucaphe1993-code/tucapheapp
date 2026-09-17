"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { formatVnd } from "@/lib/utils";
import { VariantEditDialog, type HangHoaItem } from "@/components/products/variant-edit-dialog";

// Danh sách phẳng "Hàng hóa" — mỗi dòng 1 SKU, không nhóm theo dòng sản
// phẩm — giống layout Danh mục > Hàng hóa của ERP tham khảo.
export function HangHoaTable({ items }: { items: HangHoaItem[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((it) =>
      [it.sku, it.productName, it.category, it.barcode]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(query))
    );
  }, [items, q]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input
          className="pl-9"
          placeholder="Tìm theo mã hàng, tên, nhóm hàng, barcode..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
              <th className="px-3 py-2">Mã hàng</th>
              <th className="px-3 py-2">Tên hàng hóa</th>
              <th className="px-3 py-2">Nhóm hàng</th>
              <th className="px-3 py-2">ĐVT</th>
              <th className="px-3 py-2">Barcode</th>
              <th className="px-3 py-2">Giá bán</th>
              <th className="px-3 py-2">Giá vốn chuẩn</th>
              <th className="px-3 py-2">Tồn tối thiểu</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2">Ghi chú</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-stone-500">
                  Không tìm thấy hàng hóa nào
                </td>
              </tr>
            )}
            {filtered.map((it) => (
              <tr key={it.id} className="border-b border-stone-100 last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{it.sku}</td>
                <td className="px-3 py-2">{it.productName}</td>
                <td className="px-3 py-2 text-stone-500">{it.category ?? "—"}</td>
                <td className="px-3 py-2 text-stone-500">{it.unit ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs text-stone-500">{it.barcode ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatVnd(it.unitPrice)}</td>
                <td className="px-3 py-2 whitespace-nowrap text-stone-500">{formatVnd(it.costPrice)}</td>
                <td className="px-3 py-2">{it.requiresSerial ? "Theo Serial" : (it.lowStockThreshold ?? "—")}</td>
                <td className="px-3 py-2">
                  <Badge variant={it.isActive ? "success" : "secondary"}>
                    {it.isActive ? "Đang bán" : "Ngừng bán"}
                  </Badge>
                </td>
                <td className="px-3 py-2 max-w-[200px] truncate text-stone-500">{it.note ?? "—"}</td>
                <td className="px-3 py-2">
                  <VariantEditDialog item={it} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
