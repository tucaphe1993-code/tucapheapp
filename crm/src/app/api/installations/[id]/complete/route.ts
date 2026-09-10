import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { InstallationChecklistRow, InstallationRow } from "@/types/db";

const bodySchema = z.object({ note: z.string().trim().optional() });

export async function POST(req: NextRequest, ctx: RouteContext<"/api/installations/[id]/complete">) {
  try {
    const session = await requireRole("ADMIN", "EMPLOYEE");
    const { id } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json ?? {});
    if (!parsed.success) throw new ValidationError("Dữ liệu không hợp lệ");

    const db = getDb();
    const installation = await db
      .prepare(`SELECT * FROM installations WHERE id = ?`)
      .bind(id)
      .first<InstallationRow>();
    if (!installation) throw new NotFoundError("Không tìm thấy job lắp đặt");
    if (session.user.role === "EMPLOYEE" && installation.technician_id !== session.user.id) {
      throw new ForbiddenError();
    }
    if (installation.status !== "IN_PROGRESS") {
      throw new ValidationError("Job lắp đặt phải đang thực hiện mới hoàn thành được");
    }

    const { results: checklist } = await db
      .prepare(`SELECT * FROM installation_checklists WHERE installation_id = ?`)
      .bind(id)
      .all<InstallationChecklistRow>();
    const uncheckedRequired = checklist.filter((c) => c.is_required && !c.is_checked);
    if (uncheckedRequired.length > 0) {
      throw new ValidationError(
        `Còn ${uncheckedRequired.length} mục checklist bắt buộc chưa hoàn thành: ${uncheckedRequired
          .map((c) => c.label)
          .join(", ")}`
      );
    }

    const cas = await db
      .prepare(
        `UPDATE installations SET status = 'COMPLETED', completed_at = datetime('now'),
           note = COALESCE(?, note), updated_at = datetime('now')
         WHERE id = ? AND status = 'IN_PROGRESS'`
      )
      .bind(parsed.data.note || null, id)
      .run();
    if (!cas.meta.changes) throw new ValidationError("Job lắp đặt đã hoàn thành trước đó");

    await writeAuditLog({
      userId: session.user.id,
      action: "COMPLETE_INSTALLATION",
      entity: "installation",
      entityId: id,
    });

    const updated = await db.prepare(`SELECT * FROM installations WHERE id = ?`).bind(id).first();
    return NextResponse.json({ installation: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
