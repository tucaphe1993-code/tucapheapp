import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { confirmRoastBatch } from "@/lib/services/roasting";
import { handleApiError } from "@/lib/api/errors";

export async function POST(_req: Request, ctx: RouteContext<"/api/roast-batches/[id]/confirm">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const batch = await confirmRoastBatch(id, session.user.id, getDb());

    await writeAuditLog({
      userId: session.user.id,
      action: "CONFIRM_ROAST_BATCH",
      entity: "roast_batch",
      entityId: id,
      metadata: { batchCode: batch.batch_code, inputKg: batch.input_kg, finishedKg: batch.finished_kg },
    });

    return NextResponse.json({ batch });
  } catch (err) {
    return handleApiError(err);
  }
}
