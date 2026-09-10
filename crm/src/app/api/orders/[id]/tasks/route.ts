import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { sendNotification } from "@/lib/services/notifications";
import { createChecklistForTask } from "@/lib/services/tasks";
import { handleApiError, ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { OrderItemRow, OrderRow, UserRow } from "@/types/db";

const createSchema = z.object({
  assignedTo: z.string().min(1),
  description: z.string().trim().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  dueAt: z.string().trim().optional(),
});

export async function POST(req: NextRequest, ctx: RouteContext<"/api/orders/[id]/tasks">) {
  try {
    const session = await requireRole("ADMIN");
    const { id: orderId } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }
    const { assignedTo, description, priority, dueAt } = parsed.data;

    const db = getDb();
    const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first<OrderRow>();
    if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");
    if (order.status !== "CONFIRMED") {
      throw new ValidationError("Chỉ giao việc cho đơn ở trạng thái ĐÃ XÁC NHẬN");
    }

    const existingTask = await db
      .prepare(`SELECT id FROM tasks WHERE order_id = ? AND status != 'CANCELLED' LIMIT 1`)
      .bind(orderId)
      .first();
    if (existingTask) throw new ConflictError("Đơn hàng này đã được giao việc");

    const employee = await db
      .prepare(`SELECT * FROM users WHERE id = ? AND status = 'ACTIVE'`)
      .bind(assignedTo)
      .first<UserRow>();
    if (!employee) throw new NotFoundError("Không tìm thấy nhân viên");

    const { results: items } = await db
      .prepare(`SELECT * FROM order_items WHERE order_id = ?`)
      .bind(orderId)
      .all<OrderItemRow>();
    const customer = await db
      .prepare(`SELECT name FROM customers WHERE id = ?`)
      .bind(order.customer_id)
      .first<{ name: string }>();
    const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);

    const taskId = newId();
    try {
      await db
        .prepare(
          `INSERT INTO tasks (id, order_id, assigned_to, assigned_by, title, description, priority, due_at, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'TODO')`
        )
        .bind(
          taskId,
          orderId,
          assignedTo,
          session.user.id,
          `Đóng gói đơn hàng ${order.order_code}`,
          description || null,
          priority,
          dueAt || null
        )
        .run();
    } catch (e) {
      if (String(e).includes("UNIQUE")) {
        throw new ConflictError("Đơn hàng này đã được giao việc");
      }
      throw e;
    }

    await createChecklistForTask(taskId, items);

    await sendNotification({
      userId: assignedTo,
      title: "🔔 Có đơn hàng mới",
      body: `${order.order_code} — ${customer?.name ?? ""} — Giao cho: ${employee.full_name} — Cần đóng ${totalQty} sản phẩm`,
      type: "TASK_ASSIGNED",
      referenceType: "task",
      referenceId: taskId,
      channels: ["IN_APP", "LARK"],
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "ASSIGN_TASK",
      entity: "task",
      entityId: taskId,
      metadata: { orderId, assignedTo },
    });

    const task = await db.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(taskId).first();
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
