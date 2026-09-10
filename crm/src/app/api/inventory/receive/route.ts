import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { receiveInventory } from "@/lib/services/inventory";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, ValidationError } from "@/lib/api/errors";

const bodySchema = z.object({
  productVariantId: z.string().min(1),
  quantity: z.number().int().positive(),
  note: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole("ADMIN");
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }

    await receiveInventory({ ...parsed.data, createdBy: session.user.id });

    await writeAuditLog({
      userId: session.user.id,
      action: "RECEIVE_INVENTORY",
      entity: "product_variant",
      entityId: parsed.data.productVariantId,
      metadata: { quantity: parsed.data.quantity },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
