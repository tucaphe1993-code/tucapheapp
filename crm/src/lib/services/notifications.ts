import { getDb } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { sendLarkMessage } from "@/lib/services/lark";

/**
 * Notification service abstraction. IN_APP always writes a row (polled/read
 * via /api/notifications). LARK pings a Lark group via webhook — see
 * lib/services/lark.ts; it's a no-op if LARK_WEBHOOK_URL isn't configured,
 * so call sites don't need to know whether it's set up. The `channel` union
 * is intentionally wider than what's implemented so Web Push / Email can be
 * added later without changing call sites.
 */
export type NotificationChannel = "IN_APP" | "LARK" | "WEB_PUSH" | "EMAIL" | "ZALO";

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
  if (channels.includes("LARK")) {
    const text = params.body ? `${params.title}\n${params.body}` : params.title;
    await sendLarkMessage(text);
  }
  // WEB_PUSH / EMAIL / ZALO: not implemented in this version (see spec §21).
}
