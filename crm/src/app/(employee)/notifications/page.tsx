import { getDb } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { NotificationList } from "@/components/notifications/notification-list";
import type { NotificationRow } from "@/types/db";

export default async function NotificationsPage() {
  const session = await getSession();
  const db = getDb();
  const { results } = await db
    .prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`)
    .bind(session!.user.id)
    .all<NotificationRow>();

  return (
    <div className="flex flex-col gap-3 p-4">
      <h1 className="text-lg font-bold">🔔 Thông báo</h1>
      <NotificationList initialNotifications={results} />
    </div>
  );
}
