"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export function DeleteProductButton({ productId, productName }: { productId: string; productName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    if (!confirm(`Xóa sản phẩm "${productName}"? Nếu SKU đã từng bán/nhập kho, hệ thống sẽ chuyển sang Ngừng bán thay vì xóa hẳn.`)) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(data.error ?? "Xóa sản phẩm thất bại");
      toast.success(data.deactivated ? "Đã chuyển sản phẩm sang Ngừng bán (đã có lịch sử)" : "Đã xóa sản phẩm");
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
      aria-label="Xóa sản phẩm"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
