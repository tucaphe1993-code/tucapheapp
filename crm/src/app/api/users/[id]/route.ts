import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { UserRow } from "@/types/db";

const updateSchema = z.object({
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  fullName: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/users/[id]">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) throw new ValidationError("Dữ liệu không hợp lệ");

    if (parsed.data.status === "DISABLED" && id === session.user.id) {
      throw new ValidationError("Không thể tự vô hiệu hóa tài khoản của chính mình");
    }

    const db = getDb();
    const existing = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first<UserRow>();
    if (!existing) throw new NotFoundError("Không tìm thấy nhân viên");

    const next = {
      status: parsed.data.status ?? existing.status,
      full_name: parsed.data.fullName ?? existing.full_name,
      phone: parsed.data.phone ?? existing.phone,
    };

    await db
      .prepare(`UPDATE users SET status = ?, full_name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(next.status, next.full_name, next.phone, id)
      .run();

    if (next.status === "DISABLED") {
      await db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(id).run();
    }

    await writeAuditLog({ userId: session.user.id, action: "UPDATE_USER", entity: "user", entityId: id });

    const user = await db
      .prepare(`SELECT id, email, phone, full_name, role, status, created_at, updated_at FROM users WHERE id = ?`)
      .bind(id)
      .first();
    return NextResponse.json({ user });
  } catch (err) {
    return handleApiError(err);
  }
}
