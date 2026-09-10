"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { formatVnd } from "@/lib/utils";

const FORM_LABEL: Record<string, string> = { HAT: "Hạt", BOT: "Bột" };
const PACKAGING_LABEL: Record<string, string> = { TUI_XANH: "Túi Xanh", TUI_ZIP: "Túi Zip" };

export interface CustomerPriceItem {
  id: string;
  product_variant_id: string;
  product_name: string;
  form: string;
  packaging: string;
  weight_grams: number;
  unit_price: number;
  default_unit_price: number;
}

export function CustomerPriceList({
  customerId,
  prices,
}: {
  customerId: string;
  prices: CustomerPriceItem[];
}) {
  const router = useRouter();

  async function onRemove(variantId: string) {
    const res = await fetch(`/api/customers/${customerId}/prices/${variantId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Không thể xóa giá riêng");
      return;
    }
    toast.success("Đã xóa giá riêng");
    router.refresh();
  }

  if (prices.length === 0) {
    return <div className="py-4 text-center text-sm text-stone-500">Chưa có giá riêng nào</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      {prices.map((p) => {
        const weight = p.weight_grams >= 1000 ? `${p.weight_grams / 1000}kg` : `${p.weight_grams}g`;
        return (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-stone-200 p-3 text-sm"
          >
            <div>
              <div className="font-medium">{p.product_name}</div>
              <div className="text-stone-500">
                {FORM_LABEL[p.form]} · {PACKAGING_LABEL[p.packaging]} · {weight}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="font-medium">{formatVnd(p.unit_price)}</div>
                <div className="text-xs text-stone-400 line-through">{formatVnd(p.default_unit_price)}</div>
              </div>
              <button
                onClick={() => onRemove(p.product_variant_id)}
                className="text-stone-400 hover:text-red-600"
                aria-label="Xóa giá riêng"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
