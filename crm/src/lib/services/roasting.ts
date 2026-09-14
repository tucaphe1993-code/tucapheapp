import { getDb } from "@/lib/db/client";
import { NotFoundError } from "@/lib/api/errors";
import type { RoastCostConfigRow } from "@/types/db";

/**
 * Cấu hình tỷ lệ hao hụt/chuyển đổi (bảng roast_cost_config, 1 dòng duy
 * nhất) — trước đây dùng cho module "Mẻ rang" đã bị thay thế hoàn toàn
 * bằng luồng "Bán hàng" tự quy đổi (xem sellFinishedCoffee trong
 * lib/services/inventory.ts). Chỉ còn field default_shrinkage_percent
 * được dùng: 1kg nhân xanh → (1 - default_shrinkage_percent/100)kg thành
 * phẩm. Giữ nguyên tên bảng/hàm để không phải chạy thêm migration đổi tên
 * — các field chi phí gas/nhân công/bao bì trong bảng không còn được đọc
 * ở đâu nữa nhưng vẫn giữ nguyên trong CSDL (không xóa dữ liệu).
 */
export async function getRoastCostConfig(db: D1Database = getDb()): Promise<RoastCostConfigRow> {
  const row = await db.prepare(`SELECT * FROM roast_cost_config WHERE id = 1`).first<RoastCostConfigRow>();
  if (!row) throw new NotFoundError("Chưa có cấu hình tỷ lệ chuyển đổi");
  return row;
}
