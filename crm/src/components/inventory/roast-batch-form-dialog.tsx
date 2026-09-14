"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PlusCircle } from "lucide-react";
import { formatKg } from "@/lib/utils";

interface VariantOption {
  id: string;
  sku: string;
  productName: string;
  quantityOnHand?: number;
  costPrice?: number;
}

export function RoastBatchFormDialog({
  greenVariants,
  roastedVariants,
  defaultShrinkagePercent,
  needsLaborHours,
}: {
  greenVariants: VariantOption[];
  roastedVariants: VariantOption[];
  defaultShrinkagePercent: number;
  needsLaborHours: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      greenVariantId: String(form.get("greenVariantId") || ""),
      roastedVariantId: String(form.get("roastedVariantId") || ""),
      inputKg: Number(form.get("inputKg")),
      shrinkagePercent: Number(form.get("shrinkagePercent")),
      laborHours: form.get("laborHours") ? Number(form.get("laborHours")) : undefined,
      roastedBy: String(form.get("roastedBy") || "") || undefined,
      note: String(form.get("note") || "") || undefined,
    };
    try {
      const res = await fetch("/api/roast-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Có lỗi xảy ra");
      toast.success(`Đã tạo mẻ rang nháp ${data.batch.batch_code}`);
      setOpen(false);
      router.push(`/inventory/roasting/${data.batch.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusCircle className="h-4 w-4" /> Tạo mẻ rang
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo mẻ rang mới (nháp)</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="greenVariantId">Nhân xanh đưa vào rang *</Label>
            <Select id="greenVariantId" name="greenVariantId" required defaultValue="">
              <option value="" disabled>
                -- Chọn SKU nhân xanh --
              </option>
              {greenVariants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.sku} — {v.productName} (còn {formatKg(v.quantityOnHand ?? 0)})
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="roastedVariantId">Thành phẩm cà phê rang *</Label>
            <Select id="roastedVariantId" name="roastedVariantId" required defaultValue="">
              <option value="" disabled>
                -- Chọn SKU cà phê rang --
              </option>
              {roastedVariants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.sku} — {v.productName}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inputKg">Số lượng nhân xanh đưa vào (kg) *</Label>
              <Input id="inputKg" name="inputKg" type="number" step="0.01" min={0.01} required placeholder="VD: 100" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shrinkagePercent">Hao hụt (%) *</Label>
              <Input
                id="shrinkagePercent"
                name="shrinkagePercent"
                type="number"
                step="0.01"
                min={0}
                max={99.99}
                required
                defaultValue={defaultShrinkagePercent}
              />
            </div>
          </div>
          {needsLaborHours && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="laborHours">Số giờ/ngày rang (theo cấu hình nhân công) *</Label>
              <Input id="laborHours" name="laborHours" type="number" step="0.1" min={0.1} required />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="roastedBy">Người rang</Label>
            <Input id="roastedBy" name="roastedBy" placeholder="Tên nhân viên rang" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Ghi chú</Label>
            <Textarea id="note" name="note" />
          </div>
          <p className="text-xs text-stone-400">
            Mẻ rang tạo ở đây là bản NHÁP — chưa trừ/cộng tồn kho. Sau khi xem lại chi phí, vào chi tiết mẻ rang để
            xác nhận.
          </p>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Đang tạo..." : "Tạo bản nháp"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
