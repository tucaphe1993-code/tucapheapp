"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { RoastCostConfigRow } from "@/types/db";

const LABOR_MODE_LABEL: Record<string, string> = {
  PER_KG_FINISHED: "Theo kg thành phẩm",
  PER_KG_GREEN: "Theo kg nhân xanh",
  PER_HOUR: "Theo giờ rang",
  PER_DAY: "Theo ngày rang",
};

export function RoastConfigForm({ config }: { config: RoastCostConfigRow }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      defaultShrinkagePercent: Number(form.get("defaultShrinkagePercent")),
      gasCostPerKgGreen: Number(form.get("gasCostPerKgGreen")),
      packagingCostPerKgFinished: Number(form.get("packagingCostPerKgFinished")),
      laborCostMode: String(form.get("laborCostMode")),
      laborCostValue: Number(form.get("laborCostValue")),
      otherCostPerKgFinished: Number(form.get("otherCostPerKgFinished")),
    };
    try {
      const res = await fetch("/api/roast-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Có lỗi xảy ra");
      toast.success("Đã lưu cấu hình chi phí rang");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="defaultShrinkagePercent">Hao hụt rang mặc định (%)</Label>
        <Input
          id="defaultShrinkagePercent"
          name="defaultShrinkagePercent"
          type="number"
          step="0.01"
          min={0}
          max={99.99}
          required
          defaultValue={config.default_shrinkage_percent}
        />
        <p className="text-xs text-stone-400">Có thể chỉnh riêng cho từng mẻ rang khi tạo mẻ.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="gasCostPerKgGreen">Chi phí gas (đ / kg nhân xanh)</Label>
        <Input
          id="gasCostPerKgGreen"
          name="gasCostPerKgGreen"
          type="number"
          min={0}
          required
          defaultValue={config.gas_cost_per_kg_green}
        />
        <p className="text-xs text-stone-400">
          VD: bình gas 45kg giá 1.700.000đ, năng lực 1.000kg nhân xanh → nhập 1700.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="packagingCostPerKgFinished">Chi phí bao bì (đ / kg thành phẩm)</Label>
        <Input
          id="packagingCostPerKgFinished"
          name="packagingCostPerKgFinished"
          type="number"
          min={0}
          required
          defaultValue={config.packaging_cost_per_kg_finished}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="laborCostMode">Cách tính nhân công</Label>
          <Select id="laborCostMode" name="laborCostMode" defaultValue={config.labor_cost_mode}>
            {Object.entries(LABOR_MODE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="laborCostValue">Đơn giá nhân công (đ)</Label>
          <Input
            id="laborCostValue"
            name="laborCostValue"
            type="number"
            min={0}
            required
            defaultValue={config.labor_cost_value}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="otherCostPerKgFinished">Chi phí khác (đ / kg thành phẩm)</Label>
        <Input
          id="otherCostPerKgFinished"
          name="otherCostPerKgFinished"
          type="number"
          min={0}
          required
          defaultValue={config.other_cost_per_kg_finished}
        />
        <p className="text-xs text-stone-400">Điện, nước, vệ sinh, vận hành... gộp chung nếu cần.</p>
      </div>
      <Button type="submit" disabled={loading} className="w-fit">
        {loading ? "Đang lưu..." : "Lưu cấu hình"}
      </Button>
    </form>
  );
}
