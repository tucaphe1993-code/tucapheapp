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
