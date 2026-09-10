import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { adjustInventory } from "@/lib/services/inventory";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, ValidationError } from "@/lib/api/errors";

const bodySchema = z.object({
  productVariantId: z.string().min(1),
  delta: z.number().int(),
  note: z.string().trim().min(1, "Vui lòng nhập lý do điều chỉnh"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole("ADMIN");
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }

    await adjustInventory({ ...parsed.data, createdBy: session.user.id });

    await writeAuditLog({
      userId: session.user.id,
      action: "ADJUST_INVENTORY",
      entity: "product_variant",
      entityId: parsed.data.productVariantId,
      metadata: { delta: parsed.data.delta, note: parsed.data.note },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
