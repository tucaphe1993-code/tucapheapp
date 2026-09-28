import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { OrderItemRow, OrderRow } from "@/types/db";

const updateSchema = z.object({
  unitPrice: z.number().int().nonnegative(),
});

// Sửa đơn giá 1 dòng sản phẩm sau khi đơn đã tạo (ví dụ nhập nhầm giá khi
// tạo đơn, hoặc chuyển từ báo giá có dòng gõ tay). Tính lại line_total
// đúng công thức lúc tạo đơn (CK%/Thuế% giữ nguyên) rồi cộng lại
// total_amount của cả đơn — chỉ khác 1 dòng, không đụng các dòng khác.
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/orders/[id]/items/[itemId]">) {
  try {
    const session = await requireRole("ADMIN");
    const { id, itemId } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }

    const db = getDb();
    const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first<OrderRow>();
    if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");
    if (order.status === "CANCELLED" || order.status === "COMPLETED") {
      throw new ValidationError("Không thể sửa đơn đã hủy hoặc đã hoàn thành");
    }

    const item = await db
      .prepare(`SELECT * FROM order_items WHERE id = ? AND order_id = ?`)
      .bind(itemId, id)
      .first<OrderItemRow>();
    if (!item) throw new NotFoundError("Không tìm thấy sản phẩm trong đơn hàng");

    const subtotal = parsed.data.unitPrice * item.quantity;
    const afterDiscount = subtotal * (1 - item.discount_percent / 100);
    const lineTotal = Math.round(afterDiscount * (1 + item.tax_percent / 100));

    await db
      .prepare(`UPDATE order_items SET unit_price = ?, line_total = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(parsed.data.unitPrice, lineTotal, itemId)
      .run();

    const { results: allItems } = await db
      .prepare(`SELECT line_total FROM order_items WHERE order_id = ?`)
      .bind(id)
      .all<{ line_total: number }>();
    const itemsTotal = allItems.reduce((sum, i) => sum + i.line_total, 0);
    const newTotal = Math.max(0, itemsTotal - order.discount_amount);

    await db
      .prepare(`UPDATE orders SET total_amount = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(newTotal, id)
      .run();

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE_ORDER",
      entity: "order",
      entityId: id,
      metadata: { itemId, oldUnitPrice: item.unit_price, newUnitPrice: parsed.data.unitPrice },
    });

    const updatedOrder = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first();
    return NextResponse.json({ order: updatedOrder });
  } catch (err) {
    return handleApiError(err);
  }
}
