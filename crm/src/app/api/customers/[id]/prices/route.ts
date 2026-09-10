import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { CustomerRow, ProductVariantRow } from "@/types/db";

const upsertSchema = z.object({
  productVariantId: z.string().min(1),
  unitPrice: z.number().int().nonnegative(),
});

export async function GET(req: NextRequest, ctx: RouteContext<"/api/customers/[id]/prices">) {
  try {
    await requireRole("ADMIN", "EMPLOYEE");
    const { id: customerId } = await ctx.params;
    const db = getDb();

    const { results: prices } = await db
      .prepare(
        `SELECT cp.*, pv.sku, pv.form, pv.packaging, pv.weight_grams, pv.unit_price as default_unit_price,
                p.name as product_name
         FROM customer_prices cp
         JOIN product_variants pv ON pv.id = cp.product_variant_id
         JOIN products p ON p.id = pv.product_id
         WHERE cp.customer_id = ?
         ORDER BY p.name ASC, pv.weight_grams ASC`
      )
      .bind(customerId)
      .all();

    return NextResponse.json({ prices });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/customers/[id]/prices">) {
  try {
    const session = await requireRole("ADMIN");
    const { id: customerId } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = upsertSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }
    const { productVariantId, unitPrice } = parsed.data;

    const db = getDb();
    const customer = await db
      .prepare(`SELECT * FROM customers WHERE id = ? AND is_deleted = 0`)
      .bind(customerId)
      .first<CustomerRow>();
    if (!customer) throw new NotFoundError("Không tìm thấy khách hàng");

    const variant = await db
      .prepare(`SELECT * FROM product_variants WHERE id = ? AND is_active = 1`)
      .bind(productVariantId)
      .first<ProductVariantRow>();
    if (!variant) throw new NotFoundError("Không tìm thấy sản phẩm");

    const existing = await db
      .prepare(`SELECT id FROM customer_prices WHERE customer_id = ? AND product_variant_id = ?`)
      .bind(customerId, productVariantId)
      .first<{ id: string }>();

    if (existing) {
      await db
        .prepare(`UPDATE customer_prices SET unit_price = ?, updated_at = datetime('now') WHERE id = ?`)
        .bind(unitPrice, existing.id)
        .run();
    } else {
      await db
        .prepare(
          `INSERT INTO customer_prices (id, customer_id, product_variant_id, unit_price) VALUES (?, ?, ?, ?)`
        )
        .bind(newId(), customerId, productVariantId, unitPrice)
        .run();
    }

    await writeAuditLog({
      userId: session.user.id,
      action: "SET_CUSTOMER_PRICE",
      entity: "customer_price",
      entityId: customerId,
      metadata: { productVariantId, unitPrice },
    });

    return NextResponse.json({ ok: true }, { status: existing ? 200 : 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
