import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { updateSupplier } from "@/lib/services/suppliers";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { SupplierRow } from "@/types/db";

export async function GET(_req: Request, ctx: RouteContext<"/api/suppliers/[id]">) {
  try {
    await requireRole("ADMIN", "EMPLOYEE");
    const { id } = await ctx.params;
    const db = getDb();
    const supplier = await db.prepare(`SELECT * FROM suppliers WHERE id = ?`).bind(id).first<SupplierRow>();
    if (!supplier) throw new NotFoundError("Không tìm thấy nhà cung cấp");
    return NextResponse.json({ supplier });
  } catch (err) {
    return handleApiError(err);
  }
}

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
  creditLimit: z.number().int().nonnegative().optional(),
  note: z.string().trim().optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/suppliers/[id]">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }

    const supplier = await updateSupplier(id, parsed.data);

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE_SUPPLIER",
      entity: "supplier",
      entityId: id,
    });

    return NextResponse.json({ supplier });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/suppliers/[id]">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const db = getDb();
    const supplier = await db.prepare(`SELECT * FROM suppliers WHERE id = ?`).bind(id).first<SupplierRow>();
    if (!supplier) throw new NotFoundError("Không tìm thấy nhà cung cấp");

    // Ẩn khỏi danh sách (is_deleted), không xóa hẳn — các đơn mua cũ (nếu
    // có) vẫn tham chiếu đúng nhà cung cấp này để tra cứu lịch sử.
    await db.prepare(`UPDATE suppliers SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?`).bind(id).run();

    await writeAuditLog({
      userId: session.user.id,
      action: "DELETE_SUPPLIER",
      entity: "supplier",
      entityId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
