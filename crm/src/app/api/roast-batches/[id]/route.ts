import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { deleteRoastBatchDraft } from "@/lib/services/roasting";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import type { RoastBatchRow } from "@/types/db";

export async function GET(_req: Request, ctx: RouteContext<"/api/roast-batches/[id]">) {
  try {
    await requireRole("ADMIN", "EMPLOYEE");
    const { id } = await ctx.params;
    const db = getDb();
    const batch = await db.prepare(`SELECT * FROM roast_batches WHERE id = ?`).bind(id).first<RoastBatchRow>();
    if (!batch) throw new NotFoundError("Không tìm thấy mẻ rang");
    return NextResponse.json({ batch });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/roast-batches/[id]">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    await deleteRoastBatchDraft(id, getDb());

    await writeAuditLog({
      userId: session.user.id,
      action: "DELETE_ROAST_BATCH_DRAFT",
      entity: "roast_batch",
      entityId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
