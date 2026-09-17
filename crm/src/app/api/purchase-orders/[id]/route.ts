import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { deletePurchaseOrderDraft } from "@/lib/services/purchasing";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import type { PurchaseOrderItemRow, PurchaseOrderRow, SupplierRow } from "@/types/db";

export async function GET(_req: Request, ctx: RouteContext<"/api/purchase-orders/[id]">) {
  try {
    await requireRole("ADMIN", "EMPLOYEE");
    const { id } = await ctx.params;
    const db = getDb();
    const po = await db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).bind(id).first<PurchaseOrderRow>();
    if (!po) throw new NotFoundError("Không tìm thấy đơn mua");

    const [supplier, items, payments] = await Promise.all([
      db.prepare(`SELECT * FROM suppliers WHERE id = ?`).bind(po.supplier_id).first<SupplierRow>(),
      db
        .prepare(`SELECT * FROM purchase_order_items WHERE purchase_order_id = ?`)
        .bind(id)
        .all<PurchaseOrderItemRow>(),
      db
        .prepare(`SELECT * FROM supplier_payments WHERE purchase_order_id = ? ORDER BY paid_at ASC`)
        .bind(id)
        .all(),
    ]);

    return NextResponse.json({ purchaseOrder: po, supplier, items: items.results, payments: payments.results });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/purchase-orders/[id]">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    await deletePurchaseOrderDraft(id, getDb());

    await writeAuditLog({
      userId: session.user.id,
      action: "DELETE_PURCHASE_ORDER_DRAFT",
      entity: "purchase_order",
      entityId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
