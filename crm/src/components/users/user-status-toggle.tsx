"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { SafeUser } from "@/types/db";

export function UserStatusToggle({ user, isSelf }: { user: SafeUser; isSelf: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const nextStatus = user.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error);
      toast.success(nextStatus === "ACTIVE" ? "Đã kích hoạt tài khoản" : "Đã vô hiệu hóa tài khoản");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size="sm"
      variant={user.status === "ACTIVE" ? "outline" : "secondary"}
      disabled={loading || isSelf}
      onClick={toggle}
    >
      {user.status === "ACTIVE" ? "Vô hiệu hóa" : "Kích hoạt"}
    </Button>
  );
}
