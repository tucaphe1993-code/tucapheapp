import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { OrderRow } from "@/types/db";

const bodySchema = z.object({ paymentDueDate: z.string().trim().min(1).nullable() });

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/orders/[id]/due-date">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) throw new ValidationError("Dữ liệu không hợp lệ");

    const db = getDb();
    const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first<OrderRow>();
    if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");
    if (order.status === "CANCELLED") {
      throw new ValidationError("Không thể sửa hạn thanh toán của đơn đã hủy");
    }

    await db
      .prepare(`UPDATE orders SET payment_due_date = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(parsed.data.paymentDueDate, id)
      .run();

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE_PAYMENT_DUE_DATE",
      entity: "order",
      entityId: id,
      metadata: { paymentDueDate: parsed.data.paymentDueDate },
    });

    const updated = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first();
    return NextResponse.json({ order: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
