import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { confirmPurchaseOrder } from "@/lib/services/purchasing";
import { handleApiError, ValidationError } from "@/lib/api/errors";

// key = purchase_order_item.id — chỉ cần cho các dòng SKU quản lý Serial
// (máy/thiết bị), xem confirmPurchaseOrder.
const bodySchema = z.object({
  serials: z.record(z.string(), z.array(z.string().trim().min(1))).optional(),
});

export async function POST(req: NextRequest, ctx: RouteContext<"/api/purchase-orders/[id]/confirm">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json ?? {});
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }
    const po = await confirmPurchaseOrder(id, session.user.id, getDb(), parsed.data.serials ?? {});

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
