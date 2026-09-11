import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { newId, buildSkuFromCode } from "@/lib/db/id";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { ProductRow } from "@/types/db";

// Cà phê: SKU tự sinh từ form/bao bì/quy cách (không đổi). Các loại sản
// phẩm khác (máy/thiết bị/linh kiện/dịch vụ): admin nhập SKU trực tiếp và
// các thuộc tính riêng (thương hiệu, model, bảo hành, có quản lý Serial...).
const coffeeSchema = z.object({
  form: z.enum(["HAT", "BOT"]),
  packaging: z.enum(["TUI_XANH", "TUI_ZIP"]),
  weightGrams: z.number().int().positive(),
  unit: z.string().trim().optional(),
  unitPrice: z.number().int().nonnegative(),
  costPrice: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(10),
});

const nonCoffeeSchema = z.object({
  sku: z.string().trim().min(1, "Vui lòng nhập SKU"),
  unit: z.string().trim().optional(),
  unitPrice: z.number().int().nonnegative(),
  costPrice: z.number().int().nonnegative().default(0),
  brand: z.string().trim().optional(),
  model: z.string().trim().optional(),
  supplier: z.string().trim().optional(),
  warrantyMonths: z.number().int().nonnegative().optional(),
  requiresSerial: z.boolean().default(false),
  lowStockThreshold: z.number().int().nonnegative().default(10),
});

export async function POST(req: NextRequest, ctx: RouteContext<"/api/products/[id]/variants">) {
  try {
    const session = await requireRole("ADMIN");
    const { id: productId } = await ctx.params;
    const json = await req.json().catch(() => null);

    const db = getDb();
    const product = await db
      .prepare(`SELECT * FROM products WHERE id = ?`)
      .bind(productId)
      .first<ProductRow>();
    if (!product) throw new NotFoundError("Không tìm thấy sản phẩm");

    const variantId = newId();
    const inventoryId = newId();
    let sku: string;
    let requiresSerial = false;

    if (product.product_type === "COFFEE") {
      const parsed = coffeeSchema.safeParse(json);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      }
      const { form, packaging, weightGrams, unit, unitPrice, costPrice, lowStockThreshold } = parsed.data;
      sku = buildSkuFromCode(product.code, form, packaging, weightGrams);

      const dup = await db.prepare(`SELECT id FROM product_variants WHERE sku = ?`).bind(sku).first();
      if (dup) throw new ConflictError(`SKU ${sku} đã tồn tại`);

      await db.batch([
        db
          .prepare(
            `INSERT INTO product_variants
               (id, product_id, form, packaging, weight_grams, sku, unit, unit_price, cost_price)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(variantId, productId, form, packaging, weightGrams, sku, unit || "Túi", unitPrice, costPrice),
        db
          .prepare(
            `INSERT INTO inventory (id, product_variant_id, sku, quantity_on_hand, low_stock_threshold)
             VALUES (?, ?, ?, 0, ?)`
          )
          .bind(inventoryId, variantId, sku, lowStockThreshold),
      ]);
    } else {
      const parsed = nonCoffeeSchema.safeParse(json);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      }
      const { unit, unitPrice, costPrice, brand, model, supplier, warrantyMonths, requiresSerial: reqSerial, lowStockThreshold } =
        parsed.data;
      sku = parsed.data.sku.toUpperCase();
      requiresSerial = reqSerial;

      const dup = await db.prepare(`SELECT id FROM product_variants WHERE sku = ?`).bind(sku).first();
      if (dup) throw new ConflictError(`SKU ${sku} đã tồn tại`);

      await db
        .prepare(
          `INSERT INTO product_variants
             (id, product_id, sku, unit, unit_price, cost_price, brand, model, supplier, warranty_months, requires_serial)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          variantId,
          productId,
          sku,
          unit || "Cái",
          unitPrice,
          costPrice,
          brand || null,
          model || null,
          supplier || null,
          warrantyMonths ?? null,
          requiresSerial ? 1 : 0
        )
        .run();

      // Serial-tracked SKUs are stocked via Device rows, not the quantity
      // cache — but non-serial machines/accessories still use it exactly
      // like coffee (receive/adjust/issue), so it always gets a row.
      if (!requiresSerial) {
        await db
          .prepare(
            `INSERT INTO inventory (id, product_variant_id, sku, quantity_on_hand, low_stock_threshold)
             VALUES (?, ?, ?, 0, ?)`
          )
          .bind(inventoryId, variantId, sku, lowStockThreshold)
          .run();
      }
    }

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
