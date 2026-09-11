"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CreateProtocolButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/protocols`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Tạo biên bản thất bại");
      router.push(`/protocols/${data.protocolId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" onClick={onClick} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
      Tạo biên bản lắp đặt
    </Button>
  );
}
