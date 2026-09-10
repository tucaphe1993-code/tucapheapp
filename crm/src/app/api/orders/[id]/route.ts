import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import {
  ForbiddenError,
  handleApiError,
  NotFoundError,
  ValidationError,
} from "@/lib/api/errors";
import type { OrderItemRow, OrderRow, TaskRow } from "@/types/db";

async function assertOrderVisible(orderId: string) {
  const session = await requireRole("ADMIN", "EMPLOYEE");
  const db = getDb();
  const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first<OrderRow>();
  if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");

  if (session.user.role === "EMPLOYEE") {
    const task = await db
      .prepare(`SELECT id FROM tasks WHERE order_id = ? AND assigned_to = ? LIMIT 1`)
      .bind(orderId, session.user.id)
      .first();
    if (!task) throw new ForbiddenError();
  }
  return { session, order, db };
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/orders/[id]">) {
  try {
    const { id } = await ctx.params;
    const { order, db } = await assertOrderVisible(id);

    const [{ results: items }, { results: tasks }, customer] = await Promise.all([
      db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).bind(id).all<OrderItemRow>(),
      db.prepare(`SELECT * FROM tasks WHERE order_id = ? ORDER BY created_at DESC`).bind(id).all<TaskRow>(),
      db.prepare(`SELECT * FROM customers WHERE id = ?`).bind(order.customer_id).first(),
    ]);

    return NextResponse.json({ order, items, tasks, customer });
  } catch (err) {
    return handleApiError(err);
  }
}

const updateSchema = z.object({
  deliveryDate: z.string().trim().optional().nullable(),
  deliveryMethod: z.string().trim().optional().nullable(),
  note: z.string().trim().optional().nullable(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/orders/[id]">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError("Dữ liệu không hợp lệ");
    }

    const db = getDb();
    const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first<OrderRow>();
    if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");
    if (order.status === "CANCELLED" || order.status === "COMPLETED") {
      throw new ValidationError("Không thể sửa đơn đã hủy hoặc đã hoàn thành");
    }

    await db
      .prepare(
        `UPDATE orders SET delivery_date = ?, delivery_method = ?, note = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(
        parsed.data.deliveryDate ?? order.delivery_date,
        parsed.data.deliveryMethod ?? order.delivery_method,
        parsed.data.note ?? order.note,
        id
      )
      .run();

    await writeAuditLog({ userId: session.user.id, action: "UPDATE_ORDER", entity: "order", entityId: id });

    const updated = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first();
    return NextResponse.json({ order: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
