import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { newId, buildSkuFromCode } from "@/lib/db/id";
import { slugify } from "@/lib/slug";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, ConflictError, ValidationError } from "@/lib/api/errors";
import { CATEGORY_TO_PRODUCT_TYPE } from "@/lib/constants";

const createSchema = z.object({
  sku: z.string().trim().min(1, "Vui lòng nhập mã hàng"),
  productName: z.string().trim().min(1, "Vui lòng nhập tên hàng"),
  category: z.string().trim().optional(),
  unit: z.string().trim().optional(),
  unitPrice: z.number().int().nonnegative(),
  costPrice: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(10),
  isActive: z.boolean().default(true),
  note: z.string().trim().optional(),
  // Chỉ cần khi Nhóm hàng = "Cà Phê" — cà phê đóng gói bắt buộc phải có
  // hình thức/bao bì/quy cách thì mới chọn được ở "Tạo đơn cà phê".
  form: z.enum(["HAT", "BOT"]).optional(),
  packaging: z.enum(["TUI_XANH", "TUI_ZIP"]).optional(),
  weightGrams: z.number().int().positive().optional(),
});

async function uniqueProductCode(db: D1Database, sku: string): Promise<string> {
  const base = (sku.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "SP").slice(0, 10);
  let candidate = base;
  let suffix = 1;
  while (await db.prepare(`SELECT id FROM products WHERE code = ?`).bind(candidate).first()) {
    const suffixStr = String(suffix);
    candidate = `${base.slice(0, 10 - suffixStr.length)}${suffixStr}`;
    suffix += 1;
  }
  return candidate;
}

// Tạo hàng hóa "phẳng" — 1 lần bấm tạo luôn cả dòng sản phẩm cha (ẩn với
// người dùng) lẫn SKU, giống trải nghiệm "Thêm hàng hóa" của ERP tham
// khảo (không cần hiểu khái niệm dòng sản phẩm/biến thể của hệ thống).
// Loại sản phẩm mặc định ACCESSORY — không có luồng riêng (không form/
// bao bì cà phê, không bắt buộc quản lý Serial) nên phù hợp làm mặc định
// trung tính cho hàng hóa tạo nhanh kiểu này.
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole("ADMIN");
    const json = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }
    const { productName, category, unit, unitPrice, costPrice, lowStockThreshold, isActive, note, form, packaging, weightGrams } =
      parsed.data;
    const productType = (category && CATEGORY_TO_PRODUCT_TYPE[category]) || "ACCESSORY";
    const isCoffee = productType === "COFFEE";

    if (isCoffee && (!form || !packaging || !weightGrams)) {
      throw new ValidationError("Cà phê đóng gói cần chọn đủ Hình thức/Bao bì/Quy cách");
    }

    const db = getDb();
    const code = await uniqueProductCode(db, parsed.data.sku);
    // Cà phê: SKU LUÔN tự sinh từ mã dòng + hình thức/bao bì/quy cách
    // (không đổi, khớp đúng quy ước đang dùng ở "Theo dòng sản phẩm") —
    // "Mã hàng" người dùng gõ chỉ đóng vai trò mã dòng sản phẩm (tiền tố).
    const sku = isCoffee ? buildSkuFromCode(code, form!, packaging!, weightGrams!) : parsed.data.sku.toUpperCase();

    const dup = await db.prepare(`SELECT id FROM product_variants WHERE sku = ?`).bind(sku).first();
    if (dup) throw new ConflictError(`Mã hàng ${sku} đã tồn tại`);

    const productId = newId();
    const slug = `${slugify(productName)}-${code.toLowerCase()}`;
    const variantId = newId();
    const inventoryId = newId();

    await db.batch([
      db
        .prepare(`INSERT INTO products (id, name, slug, code, product_type) VALUES (?, ?, ?, ?, ?)`)
        .bind(productId, productName, slug, code, productType),
      db
        .prepare(
          `INSERT INTO product_variants
             (id, product_id, form, packaging, weight_grams, sku, unit, unit_price, cost_price, category, note, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          variantId,
          productId,
          isCoffee ? form : null,
          isCoffee ? packaging : null,
          isCoffee ? weightGrams : null,
          sku,
          unit || (isCoffee ? "Túi" : "Cái"),
          unitPrice,
          costPrice,
          category || null,
          note || null,
          isActive ? 1 : 0
        ),
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
      metadata: { sku, quickCreate: true },
    });

    const variant = await db.prepare(`SELECT * FROM product_variants WHERE id = ?`).bind(variantId).first();
    return NextResponse.json({ variant }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
