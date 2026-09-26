import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, ValidationError } from "@/lib/api/errors";
import { assertCustomerExists, quickJobFields } from "@/lib/services/quick-jobs";

const createSchema = z.object({
  ...quickJobFields,
  customerId: quickJobFields.customerId.optional(),
  dueDate: quickJobFields.dueDate.optional(),
  note: quickJobFields.note.optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole("ADMIN");
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    const { customerId, title, dueDate, note } = parsed.data;

    const db = getDb();
    await assertCustomerExists(db, customerId);
    const id = newId();
    await db
      .prepare(`INSERT INTO quick_jobs (id, customer_id, title, due_date, note, created_by) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, customerId || null, title, dueDate || null, note || null, session.user.id)
      .run();

    await writeAuditLog({ userId: session.user.id, action: "CREATE_QUICK_JOB", entity: "quick_job", entityId: id, metadata: { title } });
    const job = await db.prepare(`SELECT * FROM quick_jobs WHERE id = ?`).bind(id).first();
    return NextResponse.json({ job }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
