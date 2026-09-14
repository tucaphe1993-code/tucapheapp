"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RoastCostConfigRow } from "@/types/db";

export function RoastConfigForm({ config }: { config: RoastCostConfigRow }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [percent, setPercent] = useState(config.default_shrinkage_percent);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      defaultShrinkagePercent: Number(form.get("defaultShrinkagePercent")),
    };
    try {
      const res = await fetch("/api/roast-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Có lỗi xảy ra");
      toast.success("Đã lưu cấu hình tỷ lệ chuyển đổi");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const ratio = (1 - percent / 100).toFixed(3);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="defaultShrinkagePercent">Tỷ lệ hao hụt rang (%)</Label>
        <Input
          id="defaultShrinkagePercent"
          name="defaultShrinkagePercent"
          type="number"
          step="0.01"
          min={0}
          max={99.99}
          required
          defaultValue={config.default_shrinkage_percent}
          onChange={(e) => setPercent(Number(e.target.value) || 0)}
        />
        <p className="text-xs text-stone-400">
          VD: 1kg nhân xanh → {ratio}kg thành phẩm. Khi &quot;Bán hàng&quot;, hệ thống tự tính ngược: KG nhân xanh
          tiêu hao = KG thành phẩm bán / {ratio}.
        </p>
      </div>
      <Button type="submit" disabled={loading} className="w-fit">
        {loading ? "Đang lưu..." : "Lưu cấu hình"}
      </Button>
    </form>
  );
}
