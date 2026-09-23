import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { recordQuotationEvent } from "@/lib/services/quotations";
import { handleApiError, ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { QuotationRow } from "@/types/db";

const bodySchema = z.object({ reason: z.string().trim().max(2000).optional() });

export async function POST(req: Request, ctx: RouteContext<"/api/quotations/public/[token]/reject">) {
  try {
    const { token } = await ctx.params;
    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    const reason = parsed.success ? parsed.data.reason : undefined;

    const db = getDb();
    const quotation = await db.prepare(`SELECT * FROM quotations WHERE public_token = ?`).bind(token).first<QuotationRow>();
    if (!quotation) throw new NotFoundError("Không tìm thấy báo giá");
    if (quotation.status === "CONVERTED") {
      throw new ConflictError("Báo giá đã được xử lý");
    }

    const cas = await db
      .prepare(
        `UPDATE quotations SET status = 'REJECTED', rejected_at = datetime('now'), reject_reason = ?, updated_at = datetime('now')
         WHERE id = ? AND status NOT IN ('ACCEPTED', 'REJECTED', 'CONVERTED')`
      )
      .bind(reason || null, quotation.id)
      .run();
    if (!cas.meta.changes) throw new ValidationError("Báo giá này đã được phản hồi trước đó");

    await recordQuotationEvent(db, { quotationId: quotation.id, action: "REJECTED", note: reason || null });

    const updated = await db.prepare(`SELECT * FROM quotations WHERE id = ?`).bind(quotation.id).first();
    return NextResponse.json({ quotation: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
