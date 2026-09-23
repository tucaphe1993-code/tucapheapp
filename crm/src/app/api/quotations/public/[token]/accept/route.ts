import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { recordQuotationEvent } from "@/lib/services/quotations";
import { handleApiError, ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { QuotationRow } from "@/types/db";

export async function POST(_req: Request, ctx: RouteContext<"/api/quotations/public/[token]/accept">) {
  try {
    const { token } = await ctx.params;
    const db = getDb();

    const quotation = await db.prepare(`SELECT * FROM quotations WHERE public_token = ?`).bind(token).first<QuotationRow>();
    if (!quotation) throw new NotFoundError("Không tìm thấy báo giá");
    if (quotation.status === "CONVERTED") {
      throw new ConflictError("Báo giá đã được xử lý");
    }
    if (quotation.status === "ACCEPTED" || quotation.status === "REJECTED") {
      throw new ValidationError("Báo giá này đã được phản hồi trước đó");
    }

    const cas = await db
      .prepare(
        `UPDATE quotations SET status = 'ACCEPTED', accepted_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ? AND status NOT IN ('ACCEPTED', 'REJECTED', 'CONVERTED')`
      )
      .bind(quotation.id)
      .run();
    if (!cas.meta.changes) throw new ValidationError("Báo giá này đã được phản hồi trước đó");

    await recordQuotationEvent(db, { quotationId: quotation.id, action: "ACCEPTED" });

    const updated = await db.prepare(`SELECT * FROM quotations WHERE id = ?`).bind(quotation.id).first();
    return NextResponse.json({ quotation: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
