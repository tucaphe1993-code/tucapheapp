"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DeviceRow } from "@/types/db";

export function EditDeviceDialog({ device }: { device: DeviceRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      warrantyStartDate: String(form.get("warrantyStartDate") || "") || null,
      warrantyEndDate: String(form.get("warrantyEndDate") || "") || null,
      supplier: String(form.get("supplier") || "") || null,
      note: String(form.get("note") || "") || null,
    };
    try {
      const res = await fetch(`/api/devices/${device.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Cập nhật thất bại");
      toast.success("Đã cập nhật thiết bị");
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="h-4 w-4" /> Sửa thông tin
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa thông tin thiết bị — {device.serial_number}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="warrantyStartDate">Bắt đầu bảo hành</Label>
              <Input
                id="warrantyStartDate"
                name="warrantyStartDate"
                type="date"
                defaultValue={device.warranty_start_date?.slice(0, 10) ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="warrantyEndDate">Hết bảo hành</Label>
              <Input
                id="warrantyEndDate"
                name="warrantyEndDate"
                type="date"
                defaultValue={device.warranty_end_date?.slice(0, 10) ?? ""}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supplier">Nhà cung cấp</Label>
            <Input id="supplier" name="supplier" defaultValue={device.supplier ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Ghi chú</Label>
            <Textarea id="note" name="note" defaultValue={device.note ?? ""} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
