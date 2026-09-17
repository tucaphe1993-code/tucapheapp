"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { ReceiveInventoryDialog, AdjustInventoryDialog } from "@/components/inventory/inventory-actions-dialog";
import { formatVnd, formatKg } from "@/lib/utils";

export interface StockRow {
  productVariantId: string;
  sku: string;
  productName: string;
  unit: string | null;
  lowStockThreshold: number;
  nhapMua: number;
  nhapKhac: number;
  xuatBan: number;
  xuatKhac: number;
  quantityOnHand: number;
  costPrice: number;
  bulkWeight: boolean;
  isRoastedFinished: boolean;
}

// Bảng "Tồn kho" dạng phẳng — mỗi dòng 1 SKU, cột giống layout Kho & Điều
// chuyển > Tồn kho của ERP tham khảo (Mã hàng/Tên/ĐVT/Tồn tối thiểu/Nhập
// mua/Nhập khác/Xuất bán/Xuất khác/Tồn hiện tại/Giá vốn chuẩn/Giá trị
// tồn/Cảnh báo), cộng thêm cột Thao tác để nhập/điều chỉnh kho tại chỗ.
export function InventoryStockTable({ rows }: { rows: StockRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) => [r.sku, r.productName].some((v) => v.toLowerCase().includes(query)));
  }, [rows, q]);

  function fmt(row: StockRow, n: number) {
    return row.bulkWeight ? formatKg(n) : n.toLocaleString("vi-VN");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input className="pl-9" placeholder="Tìm..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
              <th className="whitespace-nowrap p-3">Mã hàng</th>
              <th className="whitespace-nowrap p-3">Tên hàng hóa</th>
              <th className="whitespace-nowrap p-3">ĐVT</th>
              <th className="whitespace-nowrap p-3">Tồn tối thiểu</th>
              <th className="whitespace-nowrap p-3">Nhập mua</th>
              <th className="whitespace-nowrap p-3">Nhập khác</th>
              <th className="whitespace-nowrap p-3">Xuất bán</th>
              <th className="whitespace-nowrap p-3">Xuất khác</th>
              <th className="whitespace-nowrap p-3">Tồn hiện tại</th>
              <th className="whitespace-nowrap p-3">Giá vốn chuẩn</th>
              <th className="whitespace-nowrap p-3">Giá trị tồn</th>
              <th className="whitespace-nowrap p-3">Cảnh báo</th>
              <th className="whitespace-nowrap p-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={13} className="p-8 text-center text-stone-500">
                  Không tìm thấy hàng hóa nào
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const warning =
                r.quantityOnHand <= 0 ? "Hết hàng" : r.quantityOnHand <= r.lowStockThreshold ? "Sắp hết" : "Bình thường";
              const warningColor =
                r.quantityOnHand <= 0 ? "text-red-600" : r.quantityOnHand <= r.lowStockThreshold ? "text-amber-600" : "text-stone-500";
              return (
                <tr key={r.productVariantId} className="border-b border-stone-100 last:border-0">
                  <td className="p-3 font-mono text-xs">{r.sku}</td>
                  <td className="p-3">{r.productName}</td>
                  <td className="p-3 text-stone-500">{r.unit ?? "—"}</td>
                  <td className="p-3">{fmt(r, r.lowStockThreshold)}</td>
                  <td className="p-3">{fmt(r, r.nhapMua)}</td>
                  <td className="p-3">{fmt(r, r.nhapKhac)}</td>
                  <td className="p-3">{fmt(r, r.xuatBan)}</td>
                  <td className="p-3">{fmt(r, r.xuatKhac)}</td>
                  <td className="p-3 font-semibold">{fmt(r, r.quantityOnHand)}</td>
                  <td className="p-3 whitespace-nowrap text-stone-500">{formatVnd(r.costPrice)}</td>
                  <td className="p-3 whitespace-nowrap font-medium">{formatVnd(r.quantityOnHand * r.costPrice)}</td>
                  <td className={`p-3 font-medium ${warningColor}`}>{warning}</td>
                  <td className="p-3">
                    {r.isRoastedFinished ? (
                      <span className="text-xs text-stone-400">Xem tại Bán hàng</span>
                    ) : (
                      <div className="flex gap-2">
                        <ReceiveInventoryDialog
                          productVariantId={r.productVariantId}
                          sku={r.sku}
                          allowDecimal={r.bulkWeight}
                          unit={r.unit ?? ""}
                        />
                        <AdjustInventoryDialog
                          productVariantId={r.productVariantId}
                          sku={r.sku}
                          allowDecimal={r.bulkWeight}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
