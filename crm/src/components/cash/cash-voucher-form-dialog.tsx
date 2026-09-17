"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlusCircle, Search } from "lucide-react";
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
import type { CustomerRow, PaymentMethodRow } from "@/types/db";

const EXPENSE_GROUPS = [
  "Thuê mặt bằng",
  "Marketing",
  "Điện nước",
  "Vận chuyển",
  "Lương",
  "Thuế phí",
  "Chi phí khác",
];

/** Chỉ tạo phiếu THỦ CÔNG (Thu khác / Chi phí hoạt động) — không gắn đơn
 * bán/đơn mua, các phiếu tự động đã có sẵn khi ghi nhận thanh toán. */
export function CashVoucherFormDialog({ direction }: { direction: "IN" | "OUT" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [methods, setMethods] = useState<PaymentMethodRow[]>([]);

  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerRow[]>([]);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/payment-methods")
      .then((r) => r.json())
      .then((d) => setMethods(d.paymentMethods ?? []));
  }, [open]);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!customerQuery) return setCustomerResults([]);
      const res = await fetch(`/api/customers?q=${encodeURIComponent(customerQuery)}`);
      if (res.ok) setCustomerResults((await res.json()).customers);
    }, 250);
    return () => clearTimeout(handle);
  }, [customerQuery]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      direction,
      customerId: direction === "IN" ? customer?.id : undefined,
      expenseGroup: direction === "OUT" ? String(form.get("expenseGroup") || "") || undefined : undefined,
      paymentMethodCode: String(form.get("paymentMethodCode") || "") || undefined,
      amount: Number(form.get("amount")),
      description: String(form.get("description") || "") || undefined,
      note: String(form.get("note") || "") || undefined,
      voucherDate: String(form.get("voucherDate") || "") || undefined,
    };
    try {
      const res = await fetch("/api/cash-vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Có lỗi xảy ra");
      toast.success(direction === "IN" ? "Đã tạo phiếu thu" : "Đã tạo phiếu chi");
      setOpen(false);
      setCustomer(null);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={direction === "IN" ? "default" : "destructive"}>
          <PlusCircle className="h-4 w-4" /> Tạo phiếu {direction === "IN" ? "thu" : "chi"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo phiếu {direction === "IN" ? "thu khác" : "chi phí hoạt động"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          {direction === "IN" && (
            <div className="flex flex-col gap-1.5">
              <Label>Khách hàng (bỏ trống nếu khách lẻ)</Label>
              {customer ? (
                <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm">
                  <span>{customer.name}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCustomer(null)}>
                    Đổi
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <Input
                      className="pl-9"
                      placeholder="Tìm khách hàng..."
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                    />
                  </div>
                  {customerResults.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {customerResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="rounded-lg border border-stone-200 p-2 text-left text-sm hover:border-amber-300"
                          onClick={() => setCustomer(c)}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {direction === "OUT" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expenseGroup">Nhóm chi phí *</Label>
              <Select id="expenseGroup" name="expenseGroup" required defaultValue="">
                <option value="" disabled>
                  -- Chọn nhóm chi phí --
                </option>
                {EXPENSE_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Số tiền (đ) *</Label>
              <Input id="amount" name="amount" type="number" min={1} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="voucherDate">Ngày</Label>
              <Input id="voucherDate" name="voucherDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="paymentMethodCode">Phương thức</Label>
            <Select id="paymentMethodCode" name="paymentMethodCode" defaultValue={methods[0]?.code}>
              {methods.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Diễn giải</Label>
            <Input id="description" name="description" placeholder="VD: Thu hoàn ứng cước vận chuyển" />
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
