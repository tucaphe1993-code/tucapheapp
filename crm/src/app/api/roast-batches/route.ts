import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { createRoastBatchDraft } from "@/lib/services/roasting";
import { handleApiError, ValidationError } from "@/lib/api/errors";
import type { RoastBatchRow } from "@/types/db";

export async function GET() {
  try {
    await requireRole("ADMIN", "EMPLOYEE");
    const db = getDb();
    const { results } = await db
      .prepare(`SELECT * FROM roast_batches ORDER BY created_at DESC LIMIT 200`)
      .all<RoastBatchRow>();
    return NextResponse.json({ batches: results });
  } catch (err) {
    return handleApiError(err);
  }
}

const createSchema = z.object({
  greenVariantId: z.string().min(1),
  roastedVariantId: z.string().min(1),
  inputKg: z.number().positive(),
  shrinkagePercent: z.number().min(0).max(99.99).optional(),
  laborHours: z.number().positive().optional(),
  roastedBy: z.string().optional(),
  note: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole("ADMIN");
    const json = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }

    const batch = await createRoastBatchDraft({ ...parsed.data, createdBy: session.user.id }, getDb());

    await writeAuditLog({
      userId: session.user.id,
      action: "CREATE_ROAST_BATCH_DRAFT",
      entity: "roast_batch",
      entityId: batch.id,
      metadata: { batchCode: batch.batch_code, inputKg: batch.input_kg },
    });

    return NextResponse.json({ batch }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
