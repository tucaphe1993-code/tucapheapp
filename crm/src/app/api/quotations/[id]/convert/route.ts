import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { convertQuotationToOrder } from "@/lib/services/quotations";
import { handleApiError } from "@/lib/api/errors";

export async function POST(_req: Request, ctx: RouteContext<"/api/quotations/[id]/convert">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const db = getDb();

    const { order, created } = await convertQuotationToOrder(db, { quotationId: id, actingUserId: session.user.id });

    if (created) {
      await writeAuditLog({
        userId: session.user.id,
        action: "CONVERT_QUOTATION_TO_ORDER",
        entity: "quotation",
        entityId: id,
        metadata: { orderId: order.id, orderCode: order.order_code },
      });
    }

    return NextResponse.json({ order, created });
  } catch (err) {
    return handleApiError(err);
  }
}
