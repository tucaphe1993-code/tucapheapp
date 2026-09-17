import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import type { UnitRow } from "@/types/db";

export async function GET() {
  try {
    await requireRole("ADMIN", "EMPLOYEE");
    const db = getDb();
    const { results } = await db
      .prepare(`SELECT * FROM units WHERE is_active = 1 ORDER BY sort_order ASC`)
      .all<UnitRow>();
    return NextResponse.json({ units: results });
  } catch (err) {
    return handleApiError(err);
  }
}
