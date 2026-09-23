"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, Copy, Mail, Download, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// Hệ thống chưa có backend gửi Zalo/Email thật (không có provider nào cấu
// hình) — các nút dưới đây mở app Zalo/Email sẵn có trên máy khách hoặc
// copy link để nhân viên tự gửi, không tự động gửi ngầm. Mỗi lần bấm 1
// trong các nút này đều đánh dấu báo giá "Đã gửi".
export function SendQuoteDialog({
  quotationId,
  quoteCode,
  publicToken,
  customerEmail,
}: {
  quotationId: string;
  quoteCode: string;
  publicToken: string;
  customerEmail?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/bao-gia/public/${publicToken}` : "";

  async function markSent() {
    setBusy(true);
    try {
      const res = await fetch(`/api/quotations/${quotationId}/send`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onCopyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Đã copy link báo giá");
    } catch {
      toast.error("Không copy được — hãy tự copy link");
    }
    await markSent();
  }

  async function onOpenZalo() {
    window.open("https://zalo.me/", "_blank", "noopener,noreferrer");
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Đã mở Zalo và copy sẵn link báo giá — dán vào khung chat để gửi");
    } catch {
      toast.info("Đã mở Zalo — copy link báo giá để gửi cho khách");
    }
    await markSent();
  }

  async function onOpenEmail() {
    const subject = encodeURIComponent(`Báo giá ${quoteCode} - Tú Cà Phê`);
    const body = encodeURIComponent(
      `Kính gửi Quý khách,\n\nTú Cà Phê xin gửi báo giá ${quoteCode}, xem chi tiết tại:\n${publicUrl}\n\nTrân trọng cảm ơn Quý khách đã quan tâm và đồng hành cùng Tú Cà Phê.`
    );
    window.location.href = `mailto:${customerEmail ?? ""}?subject=${subject}&body=${body}`;
    await markSent();
  }

  async function onDownloadPdf() {
    window.open(`/bao-gia/${quotationId}/print`, "_blank", "noopener,noreferrer");
    await markSent();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Send className="h-4 w-4" /> Gửi báo giá
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gửi báo giá {quoteCode} cho khách</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <div className="rounded-lg bg-stone-50 p-2.5 text-xs text-stone-500 break-all">{publicUrl}</div>
          <Button variant="outline" className="justify-start" onClick={onCopyLink} disabled={busy}>
            <Copy className="h-4 w-4" /> Copy link báo giá
          </Button>
          <Button variant="outline" className="justify-start" onClick={onOpenZalo} disabled={busy}>
            <MessageCircle className="h-4 w-4" /> Gửi qua Zalo
          </Button>
          <Button variant="outline" className="justify-start" onClick={onOpenEmail} disabled={busy}>
            <Mail className="h-4 w-4" /> Gửi qua Email
          </Button>
          <Button variant="outline" className="justify-start" onClick={onDownloadPdf} disabled={busy}>
            <Download className="h-4 w-4" /> Tải PDF
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
