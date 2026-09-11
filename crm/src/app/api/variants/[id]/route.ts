import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { variantsHaveHistory } from "@/lib/services/products";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { ProductVariantRow } from "@/types/db";

const updateSchema = z.object({
  unitPrice: z.number().int().nonnegative().optional(),
  costPrice: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  unit: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  model: z.string().trim().optional(),
  supplier: z.string().trim().optional(),
  warrantyMonths: z.number().int().nonnegative().optional(),
  requiresSerial: z.boolean().optional(),
});

// Price/cost changes are ADMIN-only (spec §4, §31: nhân viên không được sửa giá).
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/variants/[id]">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }

    const db = getDb();
    const existing = await db
      .prepare(`SELECT * FROM product_variants WHERE id = ?`)
      .bind(id)
      .first<ProductVariantRow>();
    if (!existing) throw new NotFoundError("Không tìm thấy SKU");

    if (parsed.data.requiresSerial === false && existing.requires_serial) {
      const hasDevices = await db
        .prepare(`SELECT id FROM devices WHERE product_variant_id = ? LIMIT 1`)
        .bind(id)
        .first();
      if (hasDevices) {
        throw new ValidationError("Không thể bỏ quản lý Serial khi SKU đã có thiết bị/Serial trong hệ thống");
      }
    }

    const next = {
      unit_price: parsed.data.unitPrice ?? existing.unit_price,
      cost_price: parsed.data.costPrice ?? existing.cost_price,
      is_active: parsed.data.isActive === undefined ? existing.is_active : parsed.data.isActive ? 1 : 0,
      unit: parsed.data.unit ?? existing.unit,
      brand: parsed.data.brand ?? existing.brand,
      model: parsed.data.model ?? existing.model,
      supplier: parsed.data.supplier ?? existing.supplier,
      warranty_months: parsed.data.warrantyMonths ?? existing.warranty_months,
      requires_serial:
        parsed.data.requiresSerial === undefined ? existing.requires_serial : parsed.data.requiresSerial ? 1 : 0,
    };

    await db
      .prepare(
        `UPDATE product_variants SET unit_price = ?, cost_price = ?, is_active = ?, unit = ?, brand = ?,
           model = ?, supplier = ?, warranty_months = ?, requires_serial = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(
        next.unit_price,
        next.cost_price,
        next.is_active,
        next.unit,
        next.brand,
        next.model,
        next.supplier,
        next.warranty_months,
        next.requires_serial,
        id
      )
      .run();

    await writeAuditLog({
      userId: session.user.id,
      action: "UPDATE_VARIANT",
      entity: "product_variant",
      entityId: id,
    });

    const variant = await db
      .prepare(`SELECT * FROM product_variants WHERE id = ?`)
      .bind(id)
      .first();
    return NextResponse.json({ variant });
  } catch (err) {
    return handleApiError(err);
  }
}

// Xóa cứng khi SKU chưa từng phát sinh dữ liệu (chưa bán, chưa nhập kho,
// chưa gán giá riêng) — ngược lại chỉ chuyển sang "Ngừng bán" để không làm
// mất lịch sử đơn hàng/thiết bị đã gắn với SKU này.
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/variants/[id]">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const db = getDb();

    const existing = await db.prepare(`SELECT id FROM product_variants WHERE id = ?`).bind(id).first();
    if (!existing) throw new NotFoundError("Không tìm thấy SKU");

    const hasHistory = await variantsHaveHistory(db, [id]);
    if (hasHistory) {
      await db
        .prepare(`UPDATE product_variants SET is_active = 0, updated_at = datetime('now') WHERE id = ?`)
        .bind(id)
        .run();
    } else {
      await db.batch([
        db.prepare(`DELETE FROM inventory WHERE product_variant_id = ?`).bind(id),
        db.prepare(`DELETE FROM product_variants WHERE id = ?`).bind(id),
      ]);
    }

    await writeAuditLog({
      userId: session.user.id,
      action: "DELETE_VARIANT",
      entity: "product_variant",
      entityId: id,
      metadata: { deactivated: hasHistory },
    });

    return NextResponse.json({ ok: true, deactivated: hasHistory });
  } catch (err) {
    return handleApiError(err);
  }
}
