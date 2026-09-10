import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { InstallationRow } from "@/types/db";

export async function POST(_req: Request, ctx: RouteContext<"/api/installations/[id]/start">) {
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
    if (installation.status !== "PENDING" && installation.status !== "SCHEDULED") {
      throw new ValidationError("Job lắp đặt không ở trạng thái có thể bắt đầu");
    }

    const cas = await db
      .prepare(
        `UPDATE installations SET status = 'IN_PROGRESS', started_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ? AND status IN ('PENDING', 'SCHEDULED')`
      )
      .bind(id)
      .run();
    if (!cas.meta.changes) throw new ValidationError("Job lắp đặt đã được bắt đầu trước đó");

    await writeAuditLog({
      userId: session.user.id,
      action: "START_INSTALLATION",
      entity: "installation",
      entityId: id,
    });

    const updated = await db.prepare(`SELECT * FROM installations WHERE id = ?`).bind(id).first();
    return NextResponse.json({ installation: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
