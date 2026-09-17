import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import type { PaymentMethodRow } from "@/types/db";

export async function GET() {
  try {
    await requireRole("ADMIN", "EMPLOYEE");
    const db = getDb();
    const { results } = await db
      .prepare(`SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY sort_order ASC`)
      .all<PaymentMethodRow>();
    return NextResponse.json({ paymentMethods: results });
  } catch (err) {
    return handleApiError(err);
  }
}
