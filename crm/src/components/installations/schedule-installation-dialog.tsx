"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { SafeUser } from "@/types/db";

export function ScheduleInstallationDialog({
  installationId,
  currentTechnicianId,
  currentScheduledAt,
}: {
  installationId: string;
  currentTechnicianId: string | null;
  currentScheduledAt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [technicians, setTechnicians] = useState<SafeUser[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/users?role=EMPLOYEE")
      .then((r) => r.json())
      .then((d) => setTechnicians((d.users ?? []).filter((u: SafeUser) => u.status === "ACTIVE")));
  }, [open]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      technicianId: String(form.get("technicianId") || ""),
      scheduledAt: String(form.get("scheduledAt") || ""),
    };
    try {
      const res = await fetch(`/api/installations/${installationId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Lên lịch thất bại");
        return;
      }
      toast.success("Đã lên lịch lắp đặt");
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
          <CalendarClock className="h-4 w-4" /> Lên lịch / Phân công
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lên lịch lắp đặt</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="technicianId">Kỹ thuật viên *</Label>
            <Select id="technicianId" name="technicianId" required defaultValue={currentTechnicianId ?? ""}>
              <option value="" disabled>
                -- Chọn kỹ thuật viên --
              </option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scheduledAt">Ngày/giờ lắp *</Label>
            <Input
              id="scheduledAt"
              name="scheduledAt"
              type="datetime-local"
              required
              defaultValue={currentScheduledAt ? currentScheduledAt.slice(0, 16) : ""}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || technicians.length === 0}>
              {loading ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
