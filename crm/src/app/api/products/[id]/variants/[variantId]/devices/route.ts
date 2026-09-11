import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { receiveDevices } from "@/lib/services/devices";
import { handleApiError, ValidationError } from "@/lib/api/errors";

const bodySchema = z.object({
  serials: z.array(z.string().trim().min(1)).min(1, "Vui lòng nhập ít nhất 1 Serial"),
  supplier: z.string().trim().optional(),
  costPrice: z.number().int().nonnegative().optional(),
});

// Used by the order builder to list available Serials to sell for this SKU.
export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/products/[id]/variants/[variantId]/devices">
) {
  try {
    await requireRole("ADMIN");
    const { variantId } = await ctx.params;
    const db = getDb();
    const { results: devices } = await db
      .prepare(`SELECT * FROM devices WHERE product_variant_id = ? AND status = 'IN_STOCK' ORDER BY created_at ASC`)
      .bind(variantId)
      .all();
    return NextResponse.json({ devices });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/products/[id]/variants/[variantId]/devices">
) {
  try {
    const session = await requireRole("ADMIN");
    const { id: productId, variantId } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }

    const devices = await receiveDevices({
      productId,
      productVariantId: variantId,
      serials: parsed.data.serials,
      supplier: parsed.data.supplier,
      costPrice: parsed.data.costPrice,
      createdBy: session.user.id,
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "RECEIVE_DEVICE",
      entity: "device",
      entityId: variantId,
      metadata: { serials: parsed.data.serials },
    });

    return NextResponse.json({ devices }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
