import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { OrderRow } from "@/types/db";

const CANCELLABLE: OrderRow["status"][] = ["DRAFT", "CONFIRMED", "PACKING", "PACKED"];

// Only reachable before inventory is issued (SHIPPED) — cancelling after
// stock has left the warehouse would need a reversal flow, out of scope.
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/orders/[id]/cancel">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const db = getDb();

    const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first<OrderRow>();
    if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");
    if (!CANCELLABLE.includes(order.status)) {
      throw new ValidationError(`Không thể hủy đơn ở trạng thái ${order.status}`);
    }

    const cas = await db
      .prepare(
        `UPDATE orders SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ? AND status = ?`
      )
      .bind(id, order.status)
      .run();
    if (!cas.meta.changes) {
      throw new ValidationError("Trạng thái đơn đã thay đổi, vui lòng tải lại");
    }

    await db
      .prepare(`UPDATE tasks SET status = 'CANCELLED', updated_at = datetime('now') WHERE order_id = ? AND status IN ('TODO','IN_PROGRESS')`)
      .bind(id)
      .run();

    await writeAuditLog({ userId: session.user.id, action: "CANCEL_ORDER", entity: "order", entityId: id });

    const updated = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first();
    return NextResponse.json({ order: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
