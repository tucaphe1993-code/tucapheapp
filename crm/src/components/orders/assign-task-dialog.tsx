"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus } from "lucide-react";
import type { SafeUser } from "@/types/db";

export function AssignTaskDialog({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<SafeUser[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/users?role=EMPLOYEE")
      .then((r) => r.json())
      .then((d) => setEmployees((d.users ?? []).filter((u: SafeUser) => u.status === "ACTIVE")));
  }, [open]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      assignedTo: String(form.get("assignedTo") || ""),
      priority: String(form.get("priority") || "NORMAL"),
      dueAt: String(form.get("dueAt") || "") || undefined,
      description: String(form.get("description") || "") || undefined,
    };
    try {
      const res = await fetch(`/api/orders/${orderId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Giao việc thất bại");
        return;
      }
      toast.success("Đã giao việc cho nhân viên");
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4" /> Giao việc
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Giao việc đóng gói</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assignedTo">Nhân viên *</Label>
            <Select id="assignedTo" name="assignedTo" required defaultValue="">
              <option value="" disabled>
                -- Chọn nhân viên --
              </option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="priority">Độ ưu tiên</Label>
            <Select id="priority" name="priority" defaultValue="NORMAL">
              <option value="LOW">Thấp</option>
              <option value="NORMAL">Bình thường</option>
              <option value="HIGH">Cao</option>
              <option value="URGENT">Khẩn cấp</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dueAt">Hạn hoàn thành</Label>
            <Input id="dueAt" name="dueAt" type="datetime-local" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Ghi chú công việc</Label>
            <Textarea id="description" name="description" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || employees.length === 0}>
              {loading ? "Đang giao..." : "Giao việc"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
