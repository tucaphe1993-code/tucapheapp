import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { sellFinishedCoffee } from "@/lib/services/inventory";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, ValidationError } from "@/lib/api/errors";

const bodySchema = z.object({
  finishedVariantId: z.string().min(1),
  finishedKg: z.number().positive(),
  customerId: z.string().min(1).optional(),
  unitPrice: z.number().nonnegative().optional(),
  vatIncluded: z.boolean().optional(),
  vatPercent: z.number().min(0).max(100).optional(),
  invoiceNumber: z.string().trim().optional(),
  invoiceDate: z.string().trim().optional(),
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

    const db = getDb();
    const result = await sellFinishedCoffee({ ...parsed.data, createdBy: session.user.id }, db);

    await writeAuditLog({
      userId: session.user.id,
      action: "SELL_FINISHED_COFFEE",
      entity: "product_variant",
      entityId: parsed.data.finishedVariantId,
      metadata: {
        finishedKg: parsed.data.finishedKg,
        greenKgConsumed: result.greenKgConsumed,
        lineTotal: result.lineTotal,
      },
    });

    return NextResponse.json({ result });
  } catch (err) {
    return handleApiError(err);
  }
}
