import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { recordQuickSale } from "@/lib/services/devices";
import { handleApiError, ValidationError } from "@/lib/api/errors";

const schema = z.object({
  customerId: z.string().min(1, "Vui lòng chọn khách hàng"),
  soldAt: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

export async function POST(req: NextRequest, ctx: RouteContext<"/api/devices/[id]/quick-sale">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }

    const db = getDb();
    const soldAt = parsed.data.soldAt ? `${parsed.data.soldAt} 00:00:00` : undefined;

    const { orderId, orderCode } = await recordQuickSale(
      {
        deviceId: id,
        customerId: parsed.data.customerId,
        soldAt,
        note: parsed.data.note,
        createdBy: session.user.id,
      },
      db
    );

    await writeAuditLog({
      userId: session.user.id,
      action: "QUICK_SELL_DEVICE",
      entity: "device",
      entityId: id,
      metadata: { orderId, orderCode },
    });

    return NextResponse.json({ orderId, orderCode }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
