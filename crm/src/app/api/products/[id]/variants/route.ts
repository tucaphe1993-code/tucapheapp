import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { newId, buildSkuFromCode } from "@/lib/db/id";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { ProductRow } from "@/types/db";

const createSchema = z.object({
  form: z.enum(["HAT", "BOT"]),
  packaging: z.enum(["TUI_XANH", "TUI_ZIP"]),
  weightGrams: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
  costPrice: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(10),
});

export async function POST(req: NextRequest, ctx: RouteContext<"/api/products/[id]/variants">) {
  try {
    const session = await requireRole("ADMIN");
    const { id: productId } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }
    const { form, packaging, weightGrams, unitPrice, costPrice, lowStockThreshold } = parsed.data;

    const db = getDb();
    const product = await db
      .prepare(`SELECT * FROM products WHERE id = ?`)
      .bind(productId)
      .first<ProductRow>();
    if (!product) throw new NotFoundError("Không tìm thấy sản phẩm");

    const sku = buildSkuFromCode(product.code, form, packaging, weightGrams);

    const dup = await db
      .prepare(`SELECT id FROM product_variants WHERE sku = ?`)
      .bind(sku)
      .first();
    if (dup) throw new ConflictError(`SKU ${sku} đã tồn tại`);

    const variantId = newId();
    const inventoryId = newId();

    await db.batch([
      db
        .prepare(
          `INSERT INTO product_variants
             (id, product_id, form, packaging, weight_grams, sku, unit_price, cost_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(variantId, productId, form, packaging, weightGrams, sku, unitPrice, costPrice),
      db
        .prepare(
          `INSERT INTO inventory (id, product_variant_id, sku, quantity_on_hand, low_stock_threshold)
           VALUES (?, ?, ?, 0, ?)`
        )
        .bind(inventoryId, variantId, sku, lowStockThreshold),
    ]);

    await writeAuditLog({
      userId: session.user.id,
      action: "CREATE_VARIANT",
      entity: "product_variant",
      entityId: variantId,
      metadata: { sku },
    });

    const variant = await db
      .prepare(`SELECT * FROM product_variants WHERE id = ?`)
      .bind(variantId)
      .first();
    return NextResponse.json({ variant }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
