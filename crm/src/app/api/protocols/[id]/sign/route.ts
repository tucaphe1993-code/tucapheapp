import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { HandoverProtocolRow } from "@/types/db";

const bodySchema = z.object({
  party: z.enum(["A", "B"]),
  name: z.string().trim().min(1, "Vui lòng nhập họ tên người ký"),
  signatureData: z.string().trim().min(1, "Thiếu dữ liệu chữ ký"),
});

// Signature images are small (a hand-drawn or uploaded PNG) — capped well
// under D1's row-size limits, so they're stored as a base64 data URL
// directly in the row rather than needing object storage (R2 isn't
// enabled for this deployment).
const MAX_SIGNATURE_BYTES = 300_000;

export async function POST(req: NextRequest, ctx: RouteContext<"/api/protocols/[id]/sign">) {
  try {
    const session = await requireRole("ADMIN", "EMPLOYEE");
    const { id } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }
    if (parsed.data.signatureData.length > MAX_SIGNATURE_BYTES) {
      throw new ValidationError("Ảnh chữ ký quá lớn");
    }

    const db = getDb();
    const protocol = await db
      .prepare(`SELECT * FROM handover_protocols WHERE id = ?`)
      .bind(id)
      .first<HandoverProtocolRow>();
    if (!protocol) throw new NotFoundError("Không tìm thấy biên bản");
    if (session.user.role === "EMPLOYEE" && protocol.technician_id !== session.user.id) {
      throw new ForbiddenError();
    }
    if (protocol.status !== "PENDING_CONFIRMATION") {
      throw new ValidationError("Chỉ ký khi biên bản đang ở trạng thái Chờ xác nhận");
    }

    const { party, name, signatureData } = parsed.data;
    const column = party === "A" ? "signature_a" : "signature_b";

    await db
      .prepare(
        `UPDATE handover_protocols SET ${column}_data = ?, ${column}_name = ?, ${column}_signed_at = datetime('now'),
           updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(signatureData, name, id)
      .run();

    const refreshed = await db
      .prepare(`SELECT * FROM handover_protocols WHERE id = ?`)
      .bind(id)
      .first<HandoverProtocolRow>();

    // Once both parties have signed, the handover is complete.
    if (refreshed!.signature_a_data && refreshed!.signature_b_data && refreshed!.status === "PENDING_CONFIRMATION") {
      await db
        .prepare(
          `UPDATE handover_protocols SET status = 'HANDED_OVER', handed_over_at = datetime('now'), updated_at = datetime('now')
           WHERE id = ? AND status = 'PENDING_CONFIRMATION'`
        )
        .bind(id)
        .run();
      await writeAuditLog({ userId: session.user.id, action: "HANDOVER_PROTOCOL", entity: "handover_protocol", entityId: id });
    }

    await writeAuditLog({
      userId: session.user.id,
      action: "SIGN_PROTOCOL",
      entity: "handover_protocol",
      entityId: id,
      metadata: { party, name },
    });

    const updated = await db.prepare(`SELECT * FROM handover_protocols WHERE id = ?`).bind(id).first();
    return NextResponse.json({ protocol: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
