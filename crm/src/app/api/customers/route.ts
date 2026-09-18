import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { newId, nextCustomerCode } from "@/lib/db/id";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, ValidationError } from "@/lib/api/errors";
import type { CustomerRow } from "@/types/db";

const createSchema = z.object({
  name: z.string().trim().min(1, "Tên khách hàng bắt buộc"),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  address: z.string().trim().optional(),
  province: z.string().trim().optional(),
  note: z.string().trim().optional(),
  idCardNumber: z.string().trim().optional(),
});

// ADMIN and EMPLOYEE can both look up customers (needed to build/confirm an
// order and to see who a task's order is for); only ADMIN can create/edit.
export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN", "EMPLOYEE");
    const db = getDb();
    const q = req.nextUrl.searchParams.get("q")?.trim();

    let stmt;
    if (q) {
      stmt = db
        .prepare(
          `SELECT * FROM customers WHERE is_deleted = 0 AND (name LIKE ? OR phone LIKE ? OR id_card_number LIKE ?)
           ORDER BY created_at DESC LIMIT 100`
        )
        .bind(`%${q}%`, `%${q}%`, `%${q}%`);
    } else {
      stmt = db
        .prepare(`SELECT * FROM customers WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT 100`);
    }

    const { results } = await stmt.all<CustomerRow>();
    return NextResponse.json({ customers: results });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole("ADMIN");
    const json = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }
    const { name, phone, email, address, province, note, idCardNumber } = parsed.data;

    const db = getDb();
    const id = newId();
    const code = await nextCustomerCode(db);
    await db
      .prepare(
        `INSERT INTO customers (id, code, name, phone, email, address, province, note, id_card_number)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        code,
        name,
        phone || null,
        email || null,
        address || null,
        province || null,
        note || null,
        idCardNumber || null
      )
      .run();

    await writeAuditLog({
      userId: session.user.id,
      action: "CREATE_CUSTOMER",
      entity: "customer",
      entityId: id,
    });

    const customer = await db.prepare(`SELECT * FROM customers WHERE id = ?`).bind(id).first();
    return NextResponse.json({ customer }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
