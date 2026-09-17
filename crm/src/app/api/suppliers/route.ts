import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { createSupplier } from "@/lib/services/suppliers";
import { handleApiError, ValidationError } from "@/lib/api/errors";
import type { SupplierRow } from "@/types/db";

export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN", "EMPLOYEE");
    const db = getDb();
    const q = req.nextUrl.searchParams.get("q")?.trim();

    const stmt = q
      ? db
          .prepare(
            `SELECT * FROM suppliers WHERE is_deleted = 0 AND (name LIKE ? OR phone LIKE ? OR code LIKE ?)
             ORDER BY name ASC LIMIT 50`
          )
          .bind(`%${q}%`, `%${q}%`, `%${q}%`)
      : db.prepare(`SELECT * FROM suppliers WHERE is_deleted = 0 ORDER BY name ASC`);
    const { results } = await stmt.all<SupplierRow>();
    return NextResponse.json({ suppliers: results });
  } catch (err) {
    return handleApiError(err);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Tên nhà cung cấp bắt buộc"),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
  creditLimit: z.number().int().nonnegative().optional(),
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

    const supplier = await createSupplier(parsed.data);

    await writeAuditLog({
      userId: session.user.id,
      action: "CREATE_SUPPLIER",
      entity: "supplier",
      entityId: supplier.id,
      metadata: { name: supplier.name, code: supplier.code },
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
