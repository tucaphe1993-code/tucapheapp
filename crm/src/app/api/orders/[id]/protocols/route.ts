import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { createProtocolFromOrder } from "@/lib/services/protocols";
import { handleApiError } from "@/lib/api/errors";

export async function POST(_req: Request, ctx: RouteContext<"/api/orders/[id]/protocols">) {
  try {
    const session = await requireRole("ADMIN");
    const { id: orderId } = await ctx.params;

    const { id: protocolId, created } = await createProtocolFromOrder({
      orderId,
      createdBy: session.user.id,
    });

    if (created) {
      await writeAuditLog({
        userId: session.user.id,
        action: "CREATE_PROTOCOL",
        entity: "handover_protocol",
        entityId: protocolId,
        metadata: { orderId },
      });
    }

    return NextResponse.json({ protocolId, created }, { status: created ? 201 : 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
