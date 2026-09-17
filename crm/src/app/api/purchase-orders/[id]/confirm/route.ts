import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { confirmPurchaseOrder } from "@/lib/services/purchasing";
import { handleApiError } from "@/lib/api/errors";

export async function POST(_req: Request, ctx: RouteContext<"/api/purchase-orders/[id]/confirm">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const po = await confirmPurchaseOrder(id, session.user.id, getDb());

    await writeAuditLog({
      userId: session.user.id,
      action: "CONFIRM_PURCHASE_ORDER",
      entity: "purchase_order",
      entityId: id,
      metadata: { poCode: po.po_code, totalAmount: po.total_amount },
    });

    return NextResponse.json({ purchaseOrder: po });
  } catch (err) {
    return handleApiError(err);
  }
}
