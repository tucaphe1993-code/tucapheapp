import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { getRoastCostConfig } from "@/lib/services/roasting";
import { handleApiError, ValidationError } from "@/lib/api/errors";

export async function GET() {
  try {
    await requireRole("ADMIN", "EMPLOYEE");
    const config = await getRoastCostConfig();
    return NextResponse.json({ config });
  } catch (err) {
    return handleApiError(err);
  }
}

const updateSchema = z.object({
  defaultShrinkagePercent: z.number().min(0).max(99.99),
});

export async function PUT(req: NextRequest) {
  try {
    const session = await requireRole("ADMIN");
    const json = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }
    const d = parsed.data;
    const db = getDb();

    await db
      .prepare(
        `UPDATE roast_cost_config SET
           default_shrinkage_percent = ?, updated_at = datetime('now'), updated_by = ?
         WHERE id = 1`
      )
      .bind(d.defaultShrinkagePercent, session.user.id)
      .run();

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE_ROAST_CONFIG",
      entity: "roast_cost_config",
      entityId: "1",
      metadata: d,
    });

    const config = await getRoastCostConfig(db);
    return NextResponse.json({ config });
  } catch (err) {
    return handleApiError(err);
  }
}
