"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintProtocolButton({
  orderId,
  existingProtocolId,
}: {
  orderId: string;
  existingProtocolId: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (existingProtocolId) {
      window.open(`/protocols/${existingProtocolId}/print`, "_blank");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/protocols`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error ?? "Tạo biên bản thất bại");
      window.open(`/protocols/${data.protocolId}/print`, "_blank");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
      In biên bản lắp đặt và giao nhận
    </Button>
  );
}
