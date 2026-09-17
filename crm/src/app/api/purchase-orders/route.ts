import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { createPurchaseOrderDraft } from "@/lib/services/purchasing";
import { handleApiError, ValidationError } from "@/lib/api/errors";
import type { PurchaseOrderRow } from "@/types/db";

interface PurchaseOrderListRow extends PurchaseOrderRow {
  supplier_name: string;
  paid_amount: number;
}

export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN", "EMPLOYEE");
    const db = getDb();
    const status = req.nextUrl.searchParams.get("status");

    const stmt = status
      ? db
          .prepare(
            `SELECT po.*, s.name as supplier_name,
                    COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE purchase_order_id = po.id), 0) as paid_amount
             FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
             WHERE po.status = ? ORDER BY po.created_at DESC LIMIT 200`
          )
          .bind(status)
      : db.prepare(
          `SELECT po.*, s.name as supplier_name,
                  COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE purchase_order_id = po.id), 0) as paid_amount
           FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
           ORDER BY po.created_at DESC LIMIT 200`
        );
    const { results } = await stmt.all<PurchaseOrderListRow>();
    return NextResponse.json({ purchaseOrders: results });
  } catch (err) {
    return handleApiError(err);
  }
}

const createSchema = z.object({
  supplierId: z.string().min(1),
  paymentMethodCode: z.string().trim().optional(),
  note: z.string().trim().optional(),
  items: z
    .array(
      z.object({
        productVariantId: z.string().min(1),
        quantity: z.number().positive(),
        unitCost: z.number().int().nonnegative(),
      })
    )
    .min(1, "Đơn mua phải có ít nhất 1 dòng hàng"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole("ADMIN");
    const json = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }

    const po = await createPurchaseOrderDraft({ ...parsed.data, createdBy: session.user.id }, getDb());

    await writeAuditLog({
      userId: session.user.id,
      action: "CREATE_PURCHASE_ORDER_DRAFT",
      entity: "purchase_order",
      entityId: po.id,
      metadata: { poCode: po.po_code, totalAmount: po.total_amount },
    });

    return NextResponse.json({ purchaseOrder: po }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
