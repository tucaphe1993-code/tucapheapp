import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { duplicateQuotation } from "@/lib/services/quotations";
import { handleApiError } from "@/lib/api/errors";

export async function POST(_req: Request, ctx: RouteContext<"/api/quotations/[id]/duplicate">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const db = getDb();

    const quotation = await duplicateQuotation(db, { quotationId: id, createdBy: session.user.id });

    await writeAuditLog({
      userId: session.user.id,
      action: "DUPLICATE_QUOTATION",
      entity: "quotation",
      entityId: quotation.id,
      metadata: { sourceQuotationId: id },
    });

    return NextResponse.json({ quotation }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
