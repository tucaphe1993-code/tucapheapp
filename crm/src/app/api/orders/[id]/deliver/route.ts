import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { issueInventoryForOrder } from "@/lib/services/inventory";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError } from "@/lib/api/errors";

// Nút "Đã giao" trên TÚ QUICK — chủ đánh dấu đã giao thẳng từ Đã xác nhận /
// Đang đóng gói / Đã đóng gói (bỏ qua giao việc). Vẫn là xuất kho thật: trừ
// tồn, chống bấm 2 lần, hủy task đóng gói dang dở (xem issueInventoryForOrder).
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/orders/[id]/deliver">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;

    const { order } = await issueInventoryForOrder(id, session.user.id, undefined, { direct: true });

    await writeAuditLog({
      userId: session.user.id,
      action: "ISSUE_INVENTORY",
      entity: "order",
      entityId: id,
      metadata: { orderCode: order.order_code, via: "quick_delivered" },
    });

    return NextResponse.json({ order });
  } catch (err) {
    return handleApiError(err);
  }
}
