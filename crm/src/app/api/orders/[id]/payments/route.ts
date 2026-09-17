import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { recordCashVoucher } from "@/lib/services/cash";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { OrderRow } from "@/types/db";

// Form ghi nhận thanh toán hiện có vẫn dùng nhãn tiếng Việt tự do (không
// đổi để khỏi ảnh hưởng luồng đang chạy) — map best-effort sang mã danh
// mục phương thức thanh toán mới cho Sổ quỹ, bỏ qua nếu không khớp.
const LEGACY_METHOD_TO_CODE: Record<string, string> = {
  "Tiền mặt": "TM",
  "Chuyển khoản": "CK",
  "Khác": "KHAC",
};

const createSchema = z.object({
  amount: z.number().int().positive(),
  method: z.string().trim().optional(),
  note: z.string().trim().optional(),
  paidAt: z.string().trim().optional(),
});

export async function POST(req: NextRequest, ctx: RouteContext<"/api/orders/[id]/payments">) {
  try {
    const session = await requireRole("ADMIN");
    const { id: orderId } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }
    const { amount, method, note, paidAt } = parsed.data;

    const db = getDb();
    const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first<OrderRow>();
    if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");
    if (order.status === "CANCELLED") {
      throw new ValidationError("Không thể ghi nhận thanh toán cho đơn đã hủy");
    }

    const paymentId = newId();
    await db
      .prepare(
        `INSERT INTO payments (id, order_id, customer_id, amount, method, note, paid_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        paymentId,
        orderId,
        order.customer_id,
        amount,
        method || null,
        note || null,
        paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
        session.user.id
      )
      .run();

    await writeAuditLog({
      userId: session.user.id,
      action: "RECORD_PAYMENT",
      entity: "payment",
      entityId: paymentId,
      metadata: { orderId, amount },
    });

    // Sổ quỹ thống nhất: mọi khoản thu tiền đơn bán tự động sinh 1 dòng
    // "Phiếu thu tự động" (§ Thu Chi & Sổ quỹ) — không thay đổi công nợ,
    // vẫn tính từ payments như cũ, chỉ để có sổ quỹ đầy đủ.
    await recordCashVoucher(
      {
        direction: "IN",
        category: "SALE_ORDER",
        customerId: order.customer_id,
        referenceType: "ORDER",
        referenceId: orderId,
        paymentMethodCode: LEGACY_METHOD_TO_CODE[method ?? ""] ?? null,
        amount,
        description: `Thu tiền đơn ${order.order_code}`,
        isAuto: true,
        createdBy: session.user.id,
        voucherDate: paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
      },
      db
    );

    const payment = await db.prepare(`SELECT * FROM payments WHERE id = ?`).bind(paymentId).first();
    return NextResponse.json({ payment }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
