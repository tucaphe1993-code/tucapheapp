import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, NotFoundError } from "@/lib/api/errors";

export async function DELETE(
  req: NextRequest,
  ctx: RouteContext<"/api/customers/[id]/prices/[variantId]">
) {
  try {
    const session = await requireRole("ADMIN");
    const { id: customerId, variantId } = await ctx.params;
    const db = getDb();

    const existing = await db
      .prepare(`SELECT id FROM customer_prices WHERE customer_id = ? AND product_variant_id = ?`)
      .bind(customerId, variantId)
      .first<{ id: string }>();
    if (!existing) throw new NotFoundError("Không tìm thấy giá riêng cho sản phẩm này");

    await db.prepare(`DELETE FROM customer_prices WHERE id = ?`).bind(existing.id).run();

    await writeAuditLog({
      userId: session.user.id,
      action: "REMOVE_CUSTOMER_PRICE",
      entity: "customer_price",
      entityId: customerId,
      metadata: { productVariantId: variantId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
