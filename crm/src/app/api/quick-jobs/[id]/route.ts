import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import { assertCustomerExists, quickJobFields } from "@/lib/services/quick-jobs";

const patchSchema = z
  .object({ ...quickJobFields, status: z.enum(["OPEN", "DONE", "CANCELLED"]) })
  .partial();

const COLUMN: Record<string, string> = {
  customerId: "customer_id",
  title: "title",
  dueDate: "due_date",
  note: "note",
  status: "status",
};

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/quick-jobs/[id]">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    const fields = parsed.data;

    const db = getDb();
    if ("customerId" in fields) await assertCustomerExists(db, fields.customerId);

    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      sets.push(`${COLUMN[key]} = ?`);
      values.push(value === "" ? null : value);
    }
    if (fields.status) sets.push(fields.status === "DONE" ? "done_at = datetime('now')" : "done_at = NULL");
    if (!sets.length) throw new ValidationError("Không có gì để cập nhật");

    const result = await db
      .prepare(`UPDATE quick_jobs SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`)
      .bind(...values, id)
      .run();
    if (!result.meta.changes) throw new NotFoundError("Không tìm thấy công việc");

    await writeAuditLog({ userId: session.user.id, action: "UPDATE_QUICK_JOB", entity: "quick_job", entityId: id, metadata: fields });
    const job = await db.prepare(`SELECT * FROM quick_jobs WHERE id = ?`).bind(id).first();
    return NextResponse.json({ job });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/quick-jobs/[id]">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const db = getDb();
    const result = await db.prepare(`DELETE FROM quick_jobs WHERE id = ?`).bind(id).run();
    if (!result.meta.changes) throw new NotFoundError("Không tìm thấy công việc");
    await writeAuditLog({ userId: session.user.id, action: "DELETE_QUICK_JOB", entity: "quick_job", entityId: id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
