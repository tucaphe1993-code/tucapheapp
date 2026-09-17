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
  // Danh mục Hàng hóa (§ Sửa hàng hóa) — nhóm hàng/mã vạch/ghi chú chỉ để
  // hiển thị/lọc, ngưỡng cảnh báo sắp hết nằm ở bảng inventory riêng.
  category: z.string().trim().optional(),
  barcode: z.string().trim().optional(),
  note: z.string().trim().optional(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
  // Mã hàng (SKU) sửa được từ đây — inventory.sku là bản sao, phải đồng
  // bộ theo. Tên hàng hóa thực ra nằm ở dòng sản phẩm cha (products.name),
  // sửa ở đây sẽ đổi tên chung cho MỌI SKU cùng dòng sản phẩm.
  sku: z.string().trim().min(1).optional(),
  productName: z.string().trim().min(1).optional(),
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

    if (parsed.data.barcode) {
      const dupBarcode = await db
        .prepare(`SELECT id FROM product_variants WHERE barcode = ? AND id != ?`)
        .bind(parsed.data.barcode, id)
        .first();
      if (dupBarcode) throw new ValidationError(`Mã vạch ${parsed.data.barcode} đã được dùng cho SKU khác`);
    }

    const nextSku = parsed.data.sku ? parsed.data.sku.toUpperCase() : existing.sku;
    if (nextSku !== existing.sku) {
      const dupSku = await db
        .prepare(`SELECT id FROM product_variants WHERE sku = ? AND id != ?`)
        .bind(nextSku, id)
        .first();
      if (dupSku) throw new ValidationError(`Mã hàng ${nextSku} đã tồn tại`);
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
      category: parsed.data.category === undefined ? existing.category : parsed.data.category || null,
      barcode: parsed.data.barcode === undefined ? existing.barcode : parsed.data.barcode || null,
      note: parsed.data.note === undefined ? existing.note : parsed.data.note || null,
      sku: nextSku,
    };

    await db
      .prepare(
        `UPDATE product_variants SET unit_price = ?, cost_price = ?, is_active = ?, unit = ?, brand = ?,
           model = ?, supplier = ?, warranty_months = ?, requires_serial = ?, category = ?, barcode = ?,
           note = ?, sku = ?, updated_at = datetime('now')
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
        next.category,
        next.barcode,
        next.note,
        next.sku,
        id
      )
      .run();

    if (nextSku !== existing.sku) {
      await db
        .prepare(`UPDATE inventory SET sku = ? WHERE product_variant_id = ?`)
        .bind(nextSku, id)
        .run();
    }

    if (parsed.data.lowStockThreshold !== undefined) {
      await db
        .prepare(`UPDATE inventory SET low_stock_threshold = ? WHERE product_variant_id = ?`)
        .bind(parsed.data.lowStockThreshold, id)
        .run();
    }

    // Tên hàng hóa thực ra nằm ở dòng sản phẩm cha — sửa ở đây đổi tên
    // chung cho mọi SKU cùng dòng (đúng với cách trang Sản phẩm hiển thị).
    if (parsed.data.productName) {
      await db
        .prepare(`UPDATE products SET name = ?, updated_at = datetime('now') WHERE id = ?`)
        .bind(parsed.data.productName, existing.product_id)
        .run();
    }

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
