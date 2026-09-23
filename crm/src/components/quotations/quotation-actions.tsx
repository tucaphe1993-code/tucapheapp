"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, ExternalLink, Loader2, Pencil, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SendQuoteDialog } from "@/components/quotations/send-quote-dialog";
import type { QuotationRow } from "@/types/db";

export function QuotationActions({ quotation }: { quotation: QuotationRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const canEdit = quotation.status !== "CONVERTED";

  async function onDuplicate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/quotations/${quotation.id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Nhân bản thất bại");
      toast.success(`Đã nhân bản thành báo giá ${data.quotation.quote_code}`);
      router.push(`/bao-gia/${data.quotation.id}/edit`);
    } finally {
      setBusy(false);
    }
  }

  async function onConvert() {
    setBusy(true);
    try {
      const res = await fetch(`/api/quotations/${quotation.id}/convert`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Chuyển đơn thất bại");
      toast.success(data.created ? `Đã tạo đơn hàng ${data.order.order_code}` : `Báo giá này đã chuyển thành đơn ${data.order.order_code} trước đó`);
      router.push(`/orders/${data.order.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && (
        <Link href={`/bao-gia/${quotation.id}/edit`}>
          <Button size="sm" variant="outline">
            <Pencil className="h-4 w-4" /> Sửa
          </Button>
        </Link>
      )}
      <Button size="sm" variant="outline" onClick={onDuplicate} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} Nhân bản
      </Button>
      <Link href={`/bao-gia/${quotation.id}/print`} target="_blank" rel="noopener noreferrer">
        <Button size="sm" variant="outline">
          <ExternalLink className="h-4 w-4" /> Xuất PDF
        </Button>
      </Link>
      {quotation.status !== "CONVERTED" && (
        <SendQuoteDialog
          quotationId={quotation.id}
          quoteCode={quotation.quote_code}
          publicToken={quotation.public_token}
          customerEmail={quotation.customer_email_snapshot}
        />
      )}
      {quotation.status === "CONVERTED" ? (
        <Link href={`/orders/${quotation.converted_order_id}`}>
          <Button size="sm" variant="outline">
            <ShoppingCart className="h-4 w-4" /> Xem đơn hàng
          </Button>
        </Link>
      ) : (
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm">
              <ShoppingCart className="h-4 w-4" /> Chuyển thành đơn hàng
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Chuyển báo giá thành đơn hàng</DialogTitle>
              <DialogDescription>
                Tạo đơn hàng mới với đúng khách hàng, sản phẩm, số lượng, đơn giá, chiết khấu, VAT và ghi chú của báo giá
                này. Không tạo trùng nếu đã chuyển trước đó.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={onConvert} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Xác nhận chuyển đơn
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
