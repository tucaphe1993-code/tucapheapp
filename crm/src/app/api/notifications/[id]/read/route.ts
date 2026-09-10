import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";

export async function POST(_req: Request, ctx: RouteContext<"/api/notifications/[id]/read">) {
  try {
    const session = await requireRole("ADMIN", "EMPLOYEE");
    const { id } = await ctx.params;
    const db = getDb();
    await db
      .prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`)
      .bind(id, session.user.id)
      .run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
