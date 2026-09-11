"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Zap, Search } from "lucide-react";
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
import type { CustomerRow } from "@/types/db";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function QuickSaleDialog({ deviceId, serialNumber }: { deviceId: string; serialNumber: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerRow[]>([]);
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [soldAt, setSoldAt] = useState(todayIso());
  const [note, setNote] = useState("");

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setCustomerQuery("");
      setCustomerResults([]);
      setCustomer(null);
      setSoldAt(todayIso());
      setNote("");
    }
  }

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
    if (!customer) return toast.error("Vui lòng chọn khách hàng");
    setLoading(true);
    try {
      const res = await fetch(`/api/devices/${deviceId}/quick-sale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: customer.id, soldAt, note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Ghi nhận bán thất bại");
      toast.success(`Đã ghi nhận bán — đơn ${data.orderCode}`);
      onOpenChange(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-amber-800 hover:bg-amber-900">
          <Zap className="h-4 w-4" /> Ghi nhận bán nhanh
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ghi nhận bán nhanh — {serialNumber}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-stone-500">
          Dùng khi đã bán máy trực tiếp ngoài đời nhưng quên tạo đơn trong hệ thống. Thao tác này sẽ tự tạo 1 đơn
          hàng và đánh dấu thiết bị đã bán cho khách được chọn.
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Khách hàng</Label>
            {customer ? (
              <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 p-3">
                <div>
                  <div className="font-medium">{customer.name}</div>
                  <div className="text-sm text-stone-500">{customer.phone}</div>
                </div>
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
                    placeholder="Tìm khách hàng theo tên/SĐT..."
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                  />
                </div>
                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                  {customerResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="rounded-lg border border-stone-200 p-2 text-left text-sm hover:border-amber-300"
                      onClick={() => setCustomer(c)}
                    >
                      <div className="font-medium">{c.name}</div>
                      <div className="text-stone-500">{c.phone}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="soldAt">Ngày bán</Label>
            <Input id="soldAt" type="date" value={soldAt} onChange={(e) => setSoldAt(e.target.value)} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Ghi chú (tùy chọn)</Label>
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading || !customer}>
              {loading ? "Đang lưu..." : "Xác nhận đã bán"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
