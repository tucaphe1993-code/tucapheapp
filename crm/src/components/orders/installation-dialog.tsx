"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wrench } from "lucide-react";
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
import type { DeviceRow, OrderItemRow, SafeUser } from "@/types/db";

export function InstallationDialog({
  orderId,
  defaultLocation,
}: {
  orderId: string;
  defaultLocation?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [technicians, setTechnicians] = useState<SafeUser[]>([]);
  const [deviceItems, setDeviceItems] = useState<{ item: OrderItemRow; device: DeviceRow }[]>([]);
  const [deviceId, setDeviceId] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/users?role=EMPLOYEE")
      .then((r) => r.json())
      .then((d) => setTechnicians((d.users ?? []).filter((u: SafeUser) => u.status === "ACTIVE")));
    fetch(`/api/orders/${orderId}`)
      .then((r) => r.json())
      .then((d) => {
        const devices: DeviceRow[] = d.devices ?? [];
        const items: OrderItemRow[] = d.items ?? [];
        const deviceById = new Map(devices.map((dv) => [dv.id, dv]));
        setDeviceItems(
          items
            .filter((i) => i.device_id && deviceById.has(i.device_id))
            .map((i) => ({ item: i, device: deviceById.get(i.device_id!)! }))
        );
      });
  }, [open, orderId]);

  const selectedDevice = deviceItems.find((d) => d.device.id === deviceId);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      equipment: selectedDevice ? selectedDevice.item.product_name : String(form.get("equipment") || ""),
      deviceId: selectedDevice?.device.id,
      location: String(form.get("location") || "") || undefined,
      scheduledAt: String(form.get("scheduledAt") || "") || undefined,
      technicianId: String(form.get("technicianId") || "") || undefined,
      note: String(form.get("note") || "") || undefined,
    };
    try {
      const res = await fetch(`/api/orders/${orderId}/installations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Tạo lắp đặt thất bại");
        return;
      }
      toast.success("Đã tạo job lắp đặt");
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
          <Wrench className="h-4 w-4" /> Có lắp đặt
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo job lắp đặt</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          {deviceItems.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deviceId">Thiết bị đã bán trong đơn này</Label>
              <Select id="deviceId" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
                <option value="">-- Nhập thiết bị khác --</option>
                {deviceItems.map(({ item, device }) => (
                  <option key={device.id} value={device.id}>
                    {item.product_name} — Serial {device.serial_number}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {!selectedDevice && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="equipment">Thiết bị *</Label>
              <Input id="equipment" name="equipment" placeholder="VD: Máy pha cà phê Espresso" required />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Địa điểm lắp đặt</Label>
            <Input id="location" name="location" defaultValue={defaultLocation ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scheduledAt">Ngày/giờ lắp</Label>
              <Input id="scheduledAt" name="scheduledAt" type="datetime-local" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="technicianId">Kỹ thuật viên</Label>
              <Select id="technicianId" name="technicianId" defaultValue="">
                <option value="">-- Chưa phân công --</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Ghi chú</Label>
            <Textarea id="note" name="note" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Đang lưu..." : "Tạo job lắp đặt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
