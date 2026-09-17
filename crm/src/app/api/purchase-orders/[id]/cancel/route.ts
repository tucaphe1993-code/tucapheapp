import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { cancelPurchaseOrder } from "@/lib/services/purchasing";
import { handleApiError } from "@/lib/api/errors";

export async function POST(_req: Request, ctx: RouteContext<"/api/purchase-orders/[id]/cancel">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    await cancelPurchaseOrder(id, getDb());

    await writeAuditLog({
      userId: session.user.id,
      action: "CANCEL_PURCHASE_ORDER",
      entity: "purchase_order",
      entityId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
