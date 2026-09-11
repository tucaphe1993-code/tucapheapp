import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { variantsHaveHistory } from "@/lib/services/products";
import { handleApiError, NotFoundError } from "@/lib/api/errors";

// Xóa cứng cả dòng sản phẩm + toàn bộ SKU của nó khi chưa SKU nào phát sinh
// dữ liệu — ngược lại chỉ chuyển sản phẩm và mọi SKU của nó sang "Ngừng bán"
// để giữ nguyên lịch sử đơn hàng/thiết bị.
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/products/[id]">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const db = getDb();

    const existing = await db.prepare(`SELECT id FROM products WHERE id = ?`).bind(id).first();
    if (!existing) throw new NotFoundError("Không tìm thấy sản phẩm");

    const { results: variants } = await db
      .prepare(`SELECT id FROM product_variants WHERE product_id = ?`)
      .bind(id)
      .all<{ id: string }>();
    const variantIds = variants.map((v) => v.id);

    const hasHistory = await variantsHaveHistory(db, variantIds);

    if (hasHistory) {
      await db.batch([
        db.prepare(`UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).bind(id),
        db
          .prepare(`UPDATE product_variants SET is_active = 0, updated_at = datetime('now') WHERE product_id = ?`)
          .bind(id),
      ]);
    } else {
      await db.batch([
        db
          .prepare(`DELETE FROM inventory WHERE product_variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)`)
          .bind(id),
        db.prepare(`DELETE FROM product_variants WHERE product_id = ?`).bind(id),
        db.prepare(`DELETE FROM products WHERE id = ?`).bind(id),
      ]);
    }

    await writeAuditLog({
      userId: session.user.id,
      action: "DELETE_PRODUCT",
      entity: "product",
      entityId: id,
      metadata: { deactivated: hasHistory },
    });

    return NextResponse.json({ ok: true, deactivated: hasHistory });
  } catch (err) {
    return handleApiError(err);
  }
}
