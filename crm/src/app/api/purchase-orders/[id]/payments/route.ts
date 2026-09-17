import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { recordCashVoucher } from "@/lib/services/cash";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { PurchaseOrderRow } from "@/types/db";

const createSchema = z.object({
  amount: z.number().int().positive(),
  method: z.string().trim().optional(),
  note: z.string().trim().optional(),
  paidAt: z.string().trim().optional(),
});

export async function POST(req: NextRequest, ctx: RouteContext<"/api/purchase-orders/[id]/payments">) {
  try {
    const session = await requireRole("ADMIN");
    const { id: poId } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }
    const { amount, method, note, paidAt } = parsed.data;

    const db = getDb();
    const po = await db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).bind(poId).first<PurchaseOrderRow>();
    if (!po) throw new NotFoundError("Không tìm thấy đơn mua");
    if (po.status !== "CONFIRMED") {
      throw new ValidationError("Chỉ ghi nhận thanh toán cho đơn mua đã xác nhận");
    }

    const paymentId = newId();
    await db
      .prepare(
        `INSERT INTO supplier_payments (id, purchase_order_id, supplier_id, amount, method, note, paid_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        paymentId,
        poId,
        po.supplier_id,
        amount,
        method || null,
        note || null,
        paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
        session.user.id
      )
      .run();

    await writeAuditLog({
      userId: session.user.id,
      action: "RECORD_SUPPLIER_PAYMENT",
      entity: "supplier_payment",
      entityId: paymentId,
      metadata: { poId, amount },
    });

    await recordCashVoucher(
      {
        direction: "OUT",
        category: "PURCHASE_ORDER",
        supplierId: po.supplier_id,
        expenseGroup: "Giá vốn/Mua hàng",
        referenceType: "PURCHASE_ORDER",
        referenceId: poId,
        paymentMethodCode: method || null,
        amount,
        description: `Trả nợ đơn mua ${po.po_code}`,
        isAuto: true,
        createdBy: session.user.id,
        voucherDate: paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
      },
      db
    );

    const payment = await db.prepare(`SELECT * FROM supplier_payments WHERE id = ?`).bind(paymentId).first();
    return NextResponse.json({ payment }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
