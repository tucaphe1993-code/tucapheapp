import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { OrderRow } from "@/types/db";

// "Hoàn lại" khi lỡ bấm Hoàn thành: COMPLETED → SHIPPED (không đụng kho —
// kho đã trừ lúc giao, vẫn giữ nguyên).
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/orders/[id]/reopen">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const db = getDb();

    const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first<OrderRow>();
    if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");
    const cas = await db
      .prepare(`UPDATE orders SET status = 'SHIPPED', updated_at = datetime('now') WHERE id = ? AND status = 'COMPLETED'`)
      .bind(id)
      .run();
    if (!cas.meta.changes) throw new ValidationError("Chỉ hoàn lại được đơn đang ở trạng thái HOÀN THÀNH");

    await writeAuditLog({ userId: session.user.id, action: "REOPEN_ORDER", entity: "order", entityId: id, metadata: { from: "COMPLETED", to: "SHIPPED" } });

    const updated = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first();
    return NextResponse.json({ order: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
