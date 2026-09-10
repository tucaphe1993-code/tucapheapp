import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import type { TaskRow } from "@/types/db";

export async function GET(req: NextRequest) {
  try {
    const session = await requireRole("ADMIN", "EMPLOYEE");
    const db = getDb();
    const status = req.nextUrl.searchParams.get("status");

    if (session.user.role === "EMPLOYEE") {
      const stmt = status
        ? db
            .prepare(`SELECT * FROM tasks WHERE assigned_to = ? AND status = ? ORDER BY created_at DESC`)
            .bind(session.user.id, status)
        : db
            .prepare(`SELECT * FROM tasks WHERE assigned_to = ? ORDER BY created_at DESC`)
            .bind(session.user.id);
      const { results } = await stmt.all<TaskRow>();
      return NextResponse.json({ tasks: results });
    }

    const stmt = status
      ? db.prepare(`SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC`).bind(status)
      : db.prepare(`SELECT * FROM tasks ORDER BY created_at DESC LIMIT 300`);
    const { results } = await stmt.all<TaskRow>();
    return NextResponse.json({ tasks: results });
  } catch (err) {
    return handleApiError(err);
  }
}
