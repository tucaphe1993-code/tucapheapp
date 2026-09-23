import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { recordQuotationEvent } from "@/lib/services/quotations";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import type { QuotationItemRow, QuotationRow } from "@/types/db";

// KHÔNG yêu cầu đăng nhập — khách mở link báo giá trên điện thoại, giống
// hệt precedent /warranty/[orderId] (chỉ khác ở đây tra theo public_token
// riêng, không dùng thẳng khóa chính quotations.id).
export async function GET(_req: Request, ctx: RouteContext<"/api/quotations/public/[token]">) {
  try {
    const { token } = await ctx.params;
    const db = getDb();

    const quotation = await db
      .prepare(`SELECT * FROM quotations WHERE public_token = ?`)
      .bind(token)
      .first<QuotationRow>();
    if (!quotation) throw new NotFoundError("Không tìm thấy báo giá");

    const { results: items } = await db
      .prepare(`SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order ASC`)
      .bind(quotation.id)
      .all<QuotationItemRow>();

    // Ghi nhận "Khách đã xem" — chỉ lần đầu (không đẩy lại timeline mỗi
    // lần khách mở lại link), và không đè lên trạng thái đã chốt.
    if (quotation.status === "SENT") {
      await db
        .prepare(`UPDATE quotations SET status = 'VIEWED', viewed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = 'SENT'`)
        .bind(quotation.id)
        .run();
      await recordQuotationEvent(db, { quotationId: quotation.id, action: "VIEWED" });
      quotation.status = "VIEWED";
    }

    return NextResponse.json({ quotation, items });
  } catch (err) {
    return handleApiError(err);
  }
}
