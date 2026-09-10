"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { NotificationRow } from "@/types/db";

function targetHref(n: NotificationRow): string | null {
  if (n.reference_type === "task" && n.reference_id) return `/my-tasks/${n.reference_id}`;
  return null;
}

export function NotificationList({ initialNotifications }: { initialNotifications: NotificationRow[] }) {
  const [items, setItems] = useState(initialNotifications);

  async function markRead(n: NotificationRow) {
    if (n.is_read) return;
    setItems((cur) => cur.map((x) => (x.id === n.id ? { ...x, is_read: 1 } : x)));
    await fetch(`/api/notifications/${n.id}/read`, { method: "POST" });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">
        Chưa có thông báo nào
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((n) => {
        const href = targetHref(n);
        const card = (
          <Card
            className={cn(!n.is_read && "border-amber-300 bg-amber-50")}
            onClick={() => markRead(n)}
          >
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{n.title}</div>
                {!n.is_read && <span className="h-2 w-2 rounded-full bg-amber-600" />}
              </div>
              {n.body && <div className="text-sm text-stone-600">{n.body}</div>}
              <div className="mt-1 text-xs text-stone-400">{formatDateTime(n.created_at)}</div>
            </CardContent>
          </Card>
        );
        return href ? (
          <Link key={n.id} href={href}>
            {card}
          </Link>
        ) : (
          <div key={n.id}>{card}</div>
        );
      })}
    </div>
  );
}
