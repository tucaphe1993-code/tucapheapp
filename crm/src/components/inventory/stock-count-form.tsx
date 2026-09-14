"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatKg } from "@/lib/utils";

interface StockCountRowData {
  productVariantId: string;
  sku: string;
  productName: string;
  quantityOnHand: number;
  allowDecimal: boolean;
  unit: string;
}

export function StockCountForm({ rows }: { rows: StockCountRowData[] }) {
  const router = useRouter();
  const [actuals, setActuals] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const changedRows = useMemo(
    () =>
      rows
        .map((r) => {
          const raw = actuals[r.productVariantId];
          if (raw === undefined || raw === "") return null;
          const actual = Number(raw);
          if (Number.isNaN(actual)) return null;
          const diff = actual - r.quantityOnHand;
          if (diff === 0) return null;
          return { ...r, actual, diff };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null),
    [rows, actuals]
  );

  async function onSubmit() {
    if (changedRows.length === 0) {
      toast.error("Chưa nhập tồn thực tế cho SKU nào bị lệch");
      return;
    }
    if (!note.trim()) {
      toast.error("Vui lòng nhập lý do kiểm kê");
      return;
    }
    setSubmitting(true);
    try {
      let okCount = 0;
      for (const r of changedRows) {
        const res = await fetch("/api/inventory/adjust", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productVariantId: r.productVariantId,
            delta: r.diff,
            note: `Kiểm kê: ${note.trim()}`,
          }),
        });
        if (res.ok) {
          okCount++;
        } else {
          const data = await res.json();
          toast.error(`${r.sku}: ${data.error ?? "Lỗi điều chỉnh"}`);
        }
      }
      if (okCount > 0) {
        toast.success(`Đã ghi nhận điều chỉnh cho ${okCount} SKU`);
        setActuals({});
        setNote("");
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-stone-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
              <th className="p-3">SKU</th>
              <th className="p-3">Sản phẩm</th>
              <th className="p-3">Tồn hệ thống</th>
              <th className="p-3">Tồn thực tế</th>
              <th className="p-3">Chênh lệch</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const raw = actuals[r.productVariantId] ?? "";
              const actual = raw === "" ? null : Number(raw);
              const diff = actual === null || Number.isNaN(actual) ? null : actual - r.quantityOnHand;
              return (
                <tr key={r.productVariantId} className="border-b border-stone-100">
                  <td className="p-3 font-mono text-xs">{r.sku}</td>
                  <td className="p-3">{r.productName}</td>
                  <td className="p-3">{r.allowDecimal ? formatKg(r.quantityOnHand) : r.quantityOnHand}</td>
                  <td className="p-3">
                    <Input
                      type="number"
                      step={r.allowDecimal ? "0.01" : 1}
                      className="w-28"
                      placeholder={r.allowDecimal ? formatKg(r.quantityOnHand) : String(r.quantityOnHand)}
                      value={raw}
                      onChange={(e) =>
                        setActuals((prev) => ({ ...prev, [r.productVariantId]: e.target.value }))
                      }
                    />
                  </td>
                  <td className="p-3">
                    {diff === null ? (
                      <span className="text-stone-300">—</span>
                    ) : diff === 0 ? (
                      <span className="text-stone-400">Khớp</span>
                    ) : (
                      <span className={diff > 0 ? "font-medium text-emerald-700" : "font-medium text-red-600"}>
                        {diff > 0 ? "+" : ""}
                        {r.allowDecimal ? formatKg(diff) : diff}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {changedRows.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <div className="text-sm font-medium text-amber-900">
            {changedRows.length} SKU bị lệch — xác nhận điều chỉnh về đúng tồn thực tế:
          </div>
          <ul className="flex flex-col gap-0.5 text-sm text-amber-900">
            {changedRows.map((r) => (
              <li key={r.productVariantId}>
                {r.sku}: {r.diff > 0 ? "+" : ""}
                {r.allowDecimal ? formatKg(r.diff) : r.diff}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="count-note">Lý do kiểm kê *</Label>
            <Textarea
              id="count-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Kiểm kê định kỳ tháng 9/2026"
              required
            />
          </div>
          <Button onClick={onSubmit} disabled={submitting} className="w-fit">
            {submitting ? "Đang lưu..." : "Xác nhận điều chỉnh"}
          </Button>
        </div>
      )}
    </div>
  );
}
