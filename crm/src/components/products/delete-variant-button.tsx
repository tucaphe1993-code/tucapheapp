"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export function DeleteVariantButton({ variantId, sku }: { variantId: string; sku: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    if (!confirm(`Xóa SKU "${sku}"? Nếu đã từng bán/nhập kho, hệ thống sẽ chuyển sang Ngừng bán thay vì xóa hẳn.`)) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/variants/${variantId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(data.error ?? "Xóa SKU thất bại");
      toast.success(data.deactivated ? "Đã chuyển SKU sang Ngừng bán (đã có lịch sử)" : "Đã xóa SKU");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={loading}
      className="text-stone-400 hover:text-red-600 disabled:opacity-50"
      aria-label="Xóa SKU"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
