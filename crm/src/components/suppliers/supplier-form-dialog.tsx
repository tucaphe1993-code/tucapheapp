"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { PlusCircle } from "lucide-react";
import type { SupplierRow } from "@/types/db";

export function SupplierFormDialog({ supplier, trigger }: { supplier?: SupplierRow; trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!supplier;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      phone: String(form.get("phone") || ""),
      email: String(form.get("email") || ""),
      address: String(form.get("address") || ""),
      creditLimit: form.get("creditLimit") ? Number(form.get("creditLimit")) : undefined,
      note: String(form.get("note") || ""),
    };
    try {
      const res = await fetch(isEdit ? `/api/suppliers/${supplier!.id}` : "/api/suppliers", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Có lỗi xảy ra");
        return;
      }
      toast.success(isEdit ? "Đã cập nhật nhà cung cấp" : `Đã tạo nhà cung cấp ${data.supplier.code}`);
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <PlusCircle className="h-4 w-4" /> Thêm nhà cung cấp
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Tên nhà cung cấp *</Label>
            <Input id="name" name="name" required defaultValue={supplier?.name} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Số điện thoại</Label>
              <Input id="phone" name="phone" defaultValue={supplier?.phone ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={supplier?.email ?? ""} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Địa chỉ</Label>
            <Input id="address" name="address" defaultValue={supplier?.address ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="creditLimit">Hạn mức công nợ (đ)</Label>
            <Input id="creditLimit" name="creditLimit" type="number" min={0} defaultValue={supplier?.credit_limit ?? 0} />
            <p className="text-xs text-stone-400">Để 0 nếu không giới hạn.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Ghi chú</Label>
            <Textarea id="note" name="note" defaultValue={supplier?.note ?? ""} />
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
