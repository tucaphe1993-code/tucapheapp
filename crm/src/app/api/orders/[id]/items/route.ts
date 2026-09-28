import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { createFreeformVariant } from "@/lib/services/products";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { OrderRow } from "@/types/db";

const createSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên sản phẩm"),
  unitPrice: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
});

// Thêm 1 dòng sản phẩm vào đơn hàng đã tạo (ví dụ bổ sung phụ kiện đi kèm
// sau khi tạo đơn) — tự tạo sản phẩm/biến thể ẩn y hệt Đơn hàng tự do,
// rồi cộng thẳng vào total_amount của đơn.
export async function POST(req: NextRequest, ctx: RouteContext<"/api/orders/[id]/items">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }

    const db = getDb();
    const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first<OrderRow>();
    if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");
    if (order.status === "CANCELLED" || order.status === "COMPLETED") {
      throw new ValidationError("Không thể sửa đơn đã hủy hoặc đã hoàn thành");
    }

    const variant = await createFreeformVariant(db, {
      name: parsed.data.name,
      unitPrice: parsed.data.unitPrice,
    });

    const lineTotal = parsed.data.unitPrice * parsed.data.quantity;
    const itemId = newId();
    await db
      .prepare(
        `INSERT INTO order_items
           (id, order_id, product_variant_id, sku, product_name, quantity, unit_price, discount_percent, tax_percent, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`
      )
      .bind(itemId, id, variant.id, variant.sku, parsed.data.name, parsed.data.quantity, parsed.data.unitPrice, lineTotal)
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
      metadata: { addedItemId: itemId, name: parsed.data.name, unitPrice: parsed.data.unitPrice, quantity: parsed.data.quantity },
    });

    const updatedOrder = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first();
    return NextResponse.json({ order: updatedOrder }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
