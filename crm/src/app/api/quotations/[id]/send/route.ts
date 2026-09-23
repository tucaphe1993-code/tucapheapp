import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { recordQuotationEvent } from "@/lib/services/quotations";
import { handleApiError, ConflictError, NotFoundError } from "@/lib/api/errors";
import type { QuotationRow } from "@/types/db";

// Đánh dấu "Đã gửi khách" — hệ thống không có backend gửi Zalo/Email thật,
// chỉ ghi nhận trạng thái + timeline; việc gửi thực tế do nhân viên tự làm
// qua link zalo.me/mailto mở ở client (xem SendQuoteDialog).
export async function POST(_req: Request, ctx: RouteContext<"/api/quotations/[id]/send">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const db = getDb();

    const quotation = await db.prepare(`SELECT * FROM quotations WHERE id = ?`).bind(id).first<QuotationRow>();
    if (!quotation) throw new NotFoundError("Không tìm thấy báo giá");
    if (quotation.status === "CONVERTED") {
      throw new ConflictError("Báo giá đã chuyển thành đơn hàng");
    }

    // Chỉ đẩy trạng thái LÊN (DRAFT -> SENT) lần gửi đầu — gửi lại sau đó
    // không kéo trạng thái lùi (vd đã ACCEPTED thì vẫn giữ ACCEPTED).
    if (quotation.status === "DRAFT") {
      await db
        .prepare(`UPDATE quotations SET status = 'SENT', sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
        .bind(id)
        .run();
    } else {
      await db.prepare(`UPDATE quotations SET sent_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).bind(id).run();
    }

    await recordQuotationEvent(db, { quotationId: id, action: "SENT", userId: session.user.id });
    await writeAuditLog({ userId: session.user.id, action: "SEND_QUOTATION", entity: "quotation", entityId: id });

    const updated = await db.prepare(`SELECT * FROM quotations WHERE id = ?`).bind(id).first();
    return NextResponse.json({ quotation: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
