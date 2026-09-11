"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SignaturePad } from "@/components/protocols/signature-pad";

export function SignDialog({
  protocolId,
  party,
  label,
  defaultName,
}: {
  protocolId: string;
  party: "A" | "B";
  label: string;
  defaultName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(defaultName ?? "");
  const [signatureData, setSignatureData] = useState<string | null>(null);

  async function onSubmit() {
    if (!name.trim()) return toast.error("Vui lòng nhập họ tên người ký");
    if (!signatureData) return toast.error("Vui lòng ký hoặc tải ảnh chữ ký lên");
    setLoading(true);
    try {
      const res = await fetch(`/api/protocols/${protocolId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ party, name, signatureData }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Ký thất bại");
      toast.success("Đã ký biên bản");
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
          <PenLine className="h-4 w-4" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signerName">Họ và tên *</Label>
            <Input id="signerName" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Chữ ký *</Label>
            <SignaturePad onChange={setSignatureData} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={loading}>
            {loading ? "Đang lưu..." : "Xác nhận ký"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
