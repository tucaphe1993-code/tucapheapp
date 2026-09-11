import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { slugify } from "@/lib/slug";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, ValidationError } from "@/lib/api/errors";
import type { ProductRow, ProductVariantRow } from "@/types/db";

const createSchema = z.object({
  name: z.string().trim().min(1),
  code: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .regex(/^[A-Za-z0-9]+$/, "Mã sản phẩm chỉ gồm chữ và số"),
  description: z.string().trim().optional(),
  productType: z
    .enum(["COFFEE", "BREWER", "GRINDER", "EQUIPMENT", "ACCESSORY", "SERVICE"])
    .default("COFFEE"),
});

export async function GET() {
  try {
    const session = await requireRole("ADMIN", "EMPLOYEE");
    const db = getDb();

    const { results: products } = await db
      .prepare(`SELECT * FROM products ORDER BY created_at DESC`)
      .all<ProductRow>();
    const { results: variants } = await db
      .prepare(`SELECT * FROM product_variants ORDER BY weight_grams ASC`)
      .all<ProductVariantRow>();

    // Employees may see variants (needed to build/pack orders) but never
    // cost_price (spec §4: nhân viên không được xem giá vốn).
    const safeVariants =
      session.user.role === "EMPLOYEE"
        ? variants.map(({ cost_price: _cost, ...rest }) => rest)
        : variants;

    return NextResponse.json({
      products: products.map((p) => ({
        ...p,
        variants: safeVariants.filter((v) => v.product_id === p.id),
      })),
    });
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
    const { name, code, description, productType } = parsed.data;

    const db = getDb();
    const id = newId();
    const slug = `${slugify(name)}-${code.toLowerCase()}`;

    await db
      .prepare(
        `INSERT INTO products (id, name, slug, code, description, product_type) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(id, name, slug, code.toUpperCase(), description || null, productType)
      .run();

    await writeAuditLog({
      userId: session.user.id,
      action: "CREATE_PRODUCT",
      entity: "product",
      entityId: id,
    });

    const product = await db.prepare(`SELECT * FROM products WHERE id = ?`).bind(id).first();
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
