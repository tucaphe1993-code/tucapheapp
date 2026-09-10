import { getDb } from "@/lib/db/client";
import { newId } from "@/lib/db/id";

/**
 * Notification service abstraction. Today this only writes an in-app
 * notification row (polled/read via /api/notifications). The `channel`
 * union is intentionally wider than what's implemented so Web Push / Email
 * / Zalo can be added later without changing call sites.
 */
export type NotificationChannel = "IN_APP" | "WEB_PUSH" | "EMAIL" | "ZALO";

export interface SendNotificationParams {
  userId: string;
  title: string;
  body?: string;
  type: string;
  referenceType?: string;
  referenceId?: string;
  channels?: NotificationChannel[];
}

export async function sendNotification(params: SendNotificationParams) {
  const channels = params.channels ?? ["IN_APP"];
  if (channels.includes("IN_APP")) {
    const db = getDb();
    await db
      .prepare(
        `INSERT INTO notifications (id, user_id, title, body, type, reference_type, reference_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        newId(),
        params.userId,
        params.title,
        params.body ?? null,
        params.type,
        params.referenceType ?? null,
        params.referenceId ?? null
      )
      .run();
  }
  // WEB_PUSH / EMAIL / ZALO: not implemented in this version (see spec §21).
}
