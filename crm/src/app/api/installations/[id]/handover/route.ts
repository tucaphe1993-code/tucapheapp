import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { InstallationRow } from "@/types/db";

export async function POST(_req: Request, ctx: RouteContext<"/api/installations/[id]/handover">) {
  try {
    const session = await requireRole("ADMIN", "EMPLOYEE");
    const { id } = await ctx.params;
    const db = getDb();

    const installation = await db
      .prepare(`SELECT * FROM installations WHERE id = ?`)
      .bind(id)
      .first<InstallationRow>();
    if (!installation) throw new NotFoundError("Không tìm thấy job lắp đặt");
    if (session.user.role === "EMPLOYEE" && installation.technician_id !== session.user.id) {
      throw new ForbiddenError();
    }
    if (installation.status !== "COMPLETED") {
      throw new ValidationError("Job lắp đặt phải hoàn thành trước khi bàn giao");
    }

    const cas = await db
      .prepare(
        `UPDATE installations SET status = 'HANDED_OVER', handed_over_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ? AND status = 'COMPLETED'`
      )
      .bind(id)
      .run();
    if (!cas.meta.changes) throw new ValidationError("Job lắp đặt đã được bàn giao trước đó");

    await writeAuditLog({
      userId: session.user.id,
      action: "HANDOVER_INSTALLATION",
      entity: "installation",
      entityId: id,
    });

    const updated = await db.prepare(`SELECT * FROM installations WHERE id = ?`).bind(id).first();
    return NextResponse.json({ installation: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
