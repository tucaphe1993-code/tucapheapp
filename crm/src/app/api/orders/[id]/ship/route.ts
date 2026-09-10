import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { issueInventoryForOrder } from "@/lib/services/inventory";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError } from "@/lib/api/errors";

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/orders/[id]/ship">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;

    const { order } = await issueInventoryForOrder(id, session.user.id);

    await writeAuditLog({
      userId: session.user.id,
      action: "ISSUE_INVENTORY",
      entity: "order",
      entityId: id,
      metadata: { orderCode: order.order_code },
    });

    return NextResponse.json({ order });
  } catch (err) {
    return handleApiError(err);
  }
}
