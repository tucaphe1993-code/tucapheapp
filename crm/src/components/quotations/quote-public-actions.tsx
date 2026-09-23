"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Phone, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { COMPANY_INFO } from "@/lib/constants";
import type { QuoteStatus } from "@/types/db";

const GREEN = "#085D18";

export function QuotePublicActions({ token, status }: { token: string; status: QuoteStatus }) {
  const [current, setCurrent] = useState(status);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);

  const decided = current === "ACCEPTED" || current === "REJECTED" || current === "CONVERTED";

  async function onAccept() {
    setBusy(true);
    try {
      const res = await fetch(`/api/quotations/public/${token}/accept`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Có lỗi xảy ra");
      setCurrent("ACCEPTED");
      toast.success("Đã ghi nhận — cảm ơn Quý khách!");
    } finally {
      setBusy(false);
    }
  }

  async function onReject() {
    setBusy(true);
    try {
      const res = await fetch(`/api/quotations/public/${token}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Có lỗi xảy ra");
      setCurrent("REJECTED");
      setRejectOpen(false);
      toast.success("Đã ghi nhận phản hồi của Quý khách");
    } finally {
      setBusy(false);
    }
  }

  if (decided) {
    return (
      <div
        className="rounded-xl p-3 text-center text-sm font-semibold"
        style={
          current === "REJECTED"
            ? { backgroundColor: "#fee2e2", color: "#b91c1c" }
            : { backgroundColor: "#e7f2e9", color: GREEN }
        }
      >
        {current === "REJECTED" ? "Quý khách đã từ chối báo giá này" : "Quý khách đã đồng ý báo giá này — cảm ơn Quý khách!"}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" className="w-full" onClick={onAccept} disabled={busy}>
        <CheckCircle2 className="h-4 w-4" /> Đồng ý báo giá
      </Button>
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger asChild>
          <Button size="lg" variant="outline" className="w-full" disabled={busy}>
            <XCircle className="h-4 w-4" /> Từ chối
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lý do từ chối (không bắt buộc)</DialogTitle>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Cho Tú Cà Phê biết lý do để phục vụ tốt hơn..." rows={3} />
          <DialogFooter>
            <Button variant="destructive" onClick={onReject} disabled={busy}>
              Xác nhận từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <a href={`tel:${COMPANY_INFO.phone.replace(/\D/g, "")}`}>
        <Button size="lg" variant="ghost" className="w-full">
          <Phone className="h-4 w-4" /> Liên hệ Tú Cà Phê
        </Button>
      </a>
    </div>
  );
}
