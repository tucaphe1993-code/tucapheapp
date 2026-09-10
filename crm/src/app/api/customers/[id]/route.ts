import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { CustomerRow, OrderRow } from "@/types/db";

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal("")),
  address: z.string().trim().optional().nullable(),
  province: z.string().trim().optional().nullable(),
  note: z.string().trim().optional().nullable(),
});

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/customers/[id]">) {
  try {
    await requireRole("ADMIN", "EMPLOYEE");
    const { id } = await ctx.params;
    const db = getDb();

    const customer = await db
      .prepare(`SELECT * FROM customers WHERE id = ?`)
      .bind(id)
      .first<CustomerRow>();
    if (!customer) throw new NotFoundError("Không tìm thấy khách hàng");

    const { results: orders } = await db
      .prepare(`SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC`)
      .bind(id)
      .all<OrderRow>();

    return NextResponse.json({ customer, orders });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/customers/[id]">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }

    const db = getDb();
    const existing = await db
      .prepare(`SELECT * FROM customers WHERE id = ?`)
      .bind(id)
      .first<CustomerRow>();
    if (!existing) throw new NotFoundError("Không tìm thấy khách hàng");

    const next = { ...existing, ...parsed.data };
    await db
      .prepare(
        `UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, province = ?, note = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(
        next.name,
        next.phone || null,
        next.email || null,
        next.address || null,
        next.province || null,
        next.note || null,
        id
      )
      .run();

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE_CUSTOMER",
      entity: "customer",
      entityId: id,
    });

    const customer = await db.prepare(`SELECT * FROM customers WHERE id = ?`).bind(id).first();
    return NextResponse.json({ customer });
  } catch (err) {
    return handleApiError(err);
  }
}

// Soft delete only — never hard-delete a customer that has orders (spec §7).
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/customers/[id]">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const db = getDb();

    const existing = await db.prepare(`SELECT id FROM customers WHERE id = ?`).bind(id).first();
    if (!existing) throw new NotFoundError("Không tìm thấy khách hàng");

    const orderCount = await db
      .prepare(`SELECT COUNT(*) as c FROM orders WHERE customer_id = ?`)
      .bind(id)
      .first<{ c: number }>();

    if ((orderCount?.c ?? 0) > 0) {
      await db
        .prepare(`UPDATE customers SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?`)
        .bind(id)
        .run();
    } else {
      await db.prepare(`DELETE FROM customers WHERE id = ?`).bind(id).run();
    }

    await writeAuditLog({
      userId: session.user.id,
      action: "DELETE_CUSTOMER",
      entity: "customer",
      entityId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
