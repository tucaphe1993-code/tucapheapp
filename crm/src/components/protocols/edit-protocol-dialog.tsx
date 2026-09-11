"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
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
import type { HandoverProtocolRow, SafeUser } from "@/types/db";

export function EditProtocolDialog({ protocol }: { protocol: HandoverProtocolRow }) {
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
      contactName: String(form.get("contactName") || ""),
      contactPhone: String(form.get("contactPhone") || ""),
      installAddress: String(form.get("installAddress") || ""),
      technicianId: String(form.get("technicianId") || "") || null,
      note: String(form.get("note") || ""),
      deviceCondition: String(form.get("deviceCondition") || "") || null,
      exceptionNote: String(form.get("exceptionNote") || "") || null,
    };
    try {
      const res = await fetch(`/api/protocols/${protocol.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Cập nhật thất bại");
      toast.success("Đã cập nhật biên bản");
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
          <DialogTitle>Sửa thông tin biên bản</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactName">Người liên hệ</Label>
              <Input id="contactName" name="contactName" defaultValue={protocol.contact_name ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactPhone">Số điện thoại</Label>
              <Input id="contactPhone" name="contactPhone" defaultValue={protocol.contact_phone ?? ""} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="installAddress">Địa chỉ lắp đặt</Label>
            <Input id="installAddress" name="installAddress" defaultValue={protocol.install_address ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="technicianId">Nhân viên kỹ thuật</Label>
            <Select id="technicianId" name="technicianId" defaultValue={protocol.technician_id ?? ""}>
              <option value="">-- Chưa phân công --</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deviceCondition">Tình trạng thiết bị khi bàn giao</Label>
            <Select id="deviceCondition" name="deviceCondition" defaultValue={protocol.device_condition ?? ""}>
              <option value="">-- Chưa xác nhận --</option>
              <option value="Hoạt động bình thường">Hoạt động bình thường</option>
              <option value="Đã kiểm tra đầy đủ">Đã kiểm tra đầy đủ</option>
              <option value="Không phát hiện lỗi">Không phát hiện lỗi</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exceptionNote">Ghi nhận ngoại lệ / vấn đề tại thời điểm bàn giao</Label>
            <Textarea id="exceptionNote" name="exceptionNote" defaultValue={protocol.exception_note ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Ghi chú</Label>
            <Textarea id="note" name="note" defaultValue={protocol.note ?? ""} />
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
