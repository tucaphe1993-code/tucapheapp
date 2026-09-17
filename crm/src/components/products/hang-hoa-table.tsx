"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Trash2 } from "lucide-react";
import { formatVnd } from "@/lib/utils";
import { VariantEditDialog, type HangHoaItem } from "@/components/products/variant-edit-dialog";

// Danh sách phẳng "Hàng hóa" — mỗi dòng 1 SKU, không nhóm theo dòng sản
// phẩm — giống layout Danh mục > Hàng hóa của ERP tham khảo. Có tích chọn
// nhiều dòng để xóa hàng loạt cho nhanh (mỗi SKU vẫn theo đúng quy tắc xóa
// cứng/chuyển Ngừng bán như xóa từng cái ở DELETE /api/variants/[id]).
export function HangHoaTable({ items }: { items: HangHoaItem[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((it) =>
      [it.sku, it.productName, it.category, it.barcode]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(query))
    );
  }, [items, q]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((it) => selected.has(it.id));

  function toggleOne(id: string, checked: boolean) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected((cur) => {
      const next = new Set(cur);
      for (const it of filtered) {
        if (checked) next.add(it.id);
        else next.delete(it.id);
      }
      return next;
    });
  }

  async function onBulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`Xóa ${ids.length} hàng hóa đã chọn? Nếu SKU nào đã từng bán/nhập kho, hệ thống sẽ chuyển sang Ngừng bán thay vì xóa hẳn.`)) {
      return;
    }
    setDeleting(true);
    try {
      const results = await Promise.all(
        ids.map((id) => fetch(`/api/variants/${id}`, { method: "DELETE" }).then((r) => r.ok))
      );
      const failCount = results.filter((ok) => !ok).length;
      if (failCount > 0) {
        toast.error(`Xóa thất bại ${failCount}/${ids.length} hàng hóa`);
      } else {
        toast.success(`Đã xử lý ${ids.length} hàng hóa`);
      }
      setSelected(new Set());
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input
            className="pl-9"
            placeholder="Tìm theo mã hàng, tên, nhóm hàng, barcode..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {selected.size > 0 && (
          <Button variant="destructive" size="sm" onClick={onBulkDelete} disabled={deleting}>
            <Trash2 className="h-4 w-4" /> {deleting ? "Đang xóa..." : `Xóa (${selected.size})`}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
              <th className="w-8 px-3 py-2">
                <Checkbox checked={allFilteredSelected} onCheckedChange={(v) => toggleAll(v === true)} />
              </th>
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
                <td colSpan={12} className="px-3 py-8 text-center text-stone-500">
                  Không tìm thấy hàng hóa nào
                </td>
              </tr>
            )}
            {filtered.map((it) => (
              <tr key={it.id} className="border-b border-stone-100 last:border-0">
                <td className="px-3 py-2">
                  <Checkbox checked={selected.has(it.id)} onCheckedChange={(v) => toggleOne(it.id, v === true)} />
                </td>
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
