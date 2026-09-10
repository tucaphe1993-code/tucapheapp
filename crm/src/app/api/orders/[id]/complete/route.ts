import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { OrderRow } from "@/types/db";

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/orders/[id]/complete">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const db = getDb();

    const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first<OrderRow>();
    if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");
    if (order.status !== "SHIPPED") {
      throw new ValidationError("Đơn phải ở trạng thái ĐÃ GIAO mới đánh dấu hoàn thành");
    }

    const cas = await db
      .prepare(
        `UPDATE orders SET status = 'COMPLETED', updated_at = datetime('now') WHERE id = ? AND status = 'SHIPPED'`
      )
      .bind(id)
      .run();
    if (!cas.meta.changes) throw new ValidationError("Trạng thái đơn đã thay đổi, vui lòng tải lại");

    await writeAuditLog({ userId: session.user.id, action: "UPDATE_ORDER", entity: "order", entityId: id, metadata: { status: "COMPLETED" } });

    const updated = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first();
    return NextResponse.json({ order: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
