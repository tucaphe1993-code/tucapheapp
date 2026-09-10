import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { ProductVariantRow } from "@/types/db";

const updateSchema = z.object({
  unitPrice: z.number().int().nonnegative().optional(),
  costPrice: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

// Price/cost changes are ADMIN-only (spec §4, §31: nhân viên không được sửa giá).
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/variants/[id]">) {
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
      .prepare(`SELECT * FROM product_variants WHERE id = ?`)
      .bind(id)
      .first<ProductVariantRow>();
    if (!existing) throw new NotFoundError("Không tìm thấy SKU");

    const next = {
      unit_price: parsed.data.unitPrice ?? existing.unit_price,
      cost_price: parsed.data.costPrice ?? existing.cost_price,
      is_active: parsed.data.isActive === undefined ? existing.is_active : parsed.data.isActive ? 1 : 0,
    };

    await db
      .prepare(
        `UPDATE product_variants SET unit_price = ?, cost_price = ?, is_active = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(next.unit_price, next.cost_price, next.is_active, id)
      .run();

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE_VARIANT",
      entity: "product_variant",
      entityId: id,
    });

    const variant = await db
      .prepare(`SELECT * FROM product_variants WHERE id = ?`)
      .bind(id)
      .first();
    return NextResponse.json({ variant });
  } catch (err) {
    return handleApiError(err);
  }
}
