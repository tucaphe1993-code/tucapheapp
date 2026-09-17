"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
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
import type { PaymentMethodRow } from "@/types/db";

export function SupplierPaymentDialog({ purchaseOrderId }: { purchaseOrderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [methods, setMethods] = useState<PaymentMethodRow[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/payment-methods")
      .then((r) => r.json())
      .then((d) => setMethods(d.paymentMethods ?? []));
  }, [open]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      amount: Number(form.get("amount")),
      method: String(form.get("method") || "") || undefined,
      note: String(form.get("note") || "") || undefined,
      paidAt: String(form.get("paidAt") || "") || undefined,
    };
    try {
      const res = await fetch(`/api/purchase-orders/${purchaseOrderId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Ghi nhận thanh toán thất bại");
        return;
      }
      toast.success("Đã ghi nhận trả nợ nhà cung cấp");
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
          <Wallet className="h-4 w-4" /> Ghi nhận trả nợ
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ghi nhận thanh toán cho nhà cung cấp</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amount">Số tiền trả (đ) *</Label>
            <Input id="amount" name="amount" type="number" min={1} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="paidAt">Ngày trả</Label>
            <Input id="paidAt" name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="method">Phương thức</Label>
            <Select id="method" name="method" defaultValue={methods[0]?.code}>
              {methods.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Ghi chú</Label>
            <Textarea id="note" name="note" />
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
