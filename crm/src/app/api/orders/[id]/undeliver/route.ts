import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { reverseInventoryForOrder } from "@/lib/services/inventory";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError } from "@/lib/api/errors";

// "Hoàn lại" trên TÚ QUICK khi lỡ bấm Đã giao/Xuất kho: đơn về Đã xác nhận,
// kho được cộng trả (xem reverseInventoryForOrder).
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/orders/[id]/undeliver">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;

    const { order, restored } = await reverseInventoryForOrder(id);

    await writeAuditLog({
      userId: session.user.id,
      action: "REVERSE_DELIVERY",
      entity: "order",
      entityId: id,
      metadata: { orderCode: order.order_code, restored },
    });

    return NextResponse.json({ order });
  } catch (err) {
    return handleApiError(err);
  }
}
