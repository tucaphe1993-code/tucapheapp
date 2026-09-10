import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import type { NotificationRow } from "@/types/db";

export async function GET() {
  try {
    const session = await requireRole("ADMIN", "EMPLOYEE");
    const db = getDb();
    const { results } = await db
      .prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`)
      .bind(session.user.id)
      .all<NotificationRow>();
    return NextResponse.json({ notifications: results });
  } catch (err) {
    return handleApiError(err);
  }
}
