import { newId } from "@/lib/db/id";
import { slugify } from "@/lib/slug";
import type { ProductVariantRow } from "@/types/db";

/**
 * "Đơn hàng tự do" (máy pha/máy xay cũ, đã qua sử dụng, không có trong
 * danh mục) — tự sinh 1 products + 1 product_variants "ẩn" (is_freeform=1)
 * ngay lúc lưu đơn, để toàn bộ pipeline order_items/hoá đơn/phiếu bảo
 * hành/biên bản bàn giao sẵn có chạy nguyên xi (product_type='EQUIPMENT'
 * nên vẫn vào biên bản bàn giao + phiếu bảo hành như máy thật). Không quản
 * lý Serial (requires_serial=0). Ẩn khỏi trang Sản phẩm và mọi ô "chọn sản
 * phẩm có sẵn" qua cờ is_freeform — không phải hàng thật trong danh mục.
 */
export async function createFreeformVariant(
  db: D1Database,
  params: { name: string; unitPrice: number; warrantyMonths?: number | null }
): Promise<ProductVariantRow & { product_name: string }> {
  const productId = newId();
  const variantId = newId();
  const suffix = newId().slice(0, 8).toUpperCase();
  const code = `TUDO-${suffix}`;
  const slug = `${slugify(params.name)}-${suffix.toLowerCase()}`;

  await db.batch([
    db
      .prepare(`INSERT INTO products (id, name, slug, code, product_type, is_freeform) VALUES (?, ?, ?, ?, 'EQUIPMENT', 1)`)
      .bind(productId, params.name, slug, code),
    db
      .prepare(
        `INSERT INTO product_variants (id, product_id, sku, unit_price, warranty_months, requires_serial, is_active)
         VALUES (?, ?, ?, ?, ?, 0, 1)`
      )
      .bind(variantId, productId, code, params.unitPrice, params.warrantyMonths ?? null),
  ]);

  const variant = await db
    .prepare(`SELECT pv.*, p.name as product_name FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = ?`)
    .bind(variantId)
    .first<ProductVariantRow & { product_name: string }>();
  return variant!;
}

/**
 * Có SKU nào trong danh sách đã thực sự phát sinh dữ liệu (đã bán, đã nhập
 * kho, đã gán giá riêng cho khách...) chưa. Dùng để quyết định xóa cứng hay
 * chỉ ngừng bán — không tính dòng `inventory` (luôn được tạo sẵn khi tạo SKU,
 * kể cả chưa từng có giao dịch nào) là "đã có lịch sử".
 */
export async function variantsHaveHistory(db: D1Database, variantIds: string[]): Promise<boolean> {
  if (variantIds.length === 0) return false;
  const placeholders = variantIds.map(() => "?").join(",");
  const tables = ["order_items", "devices", "customer_prices", "inventory_transactions"];
  for (const table of tables) {
    const row = await db
      .prepare(`SELECT 1 FROM ${table} WHERE product_variant_id IN (${placeholders}) LIMIT 1`)
      .bind(...variantIds)
      .first();
    if (row) return true;
  }
  return false;
}
