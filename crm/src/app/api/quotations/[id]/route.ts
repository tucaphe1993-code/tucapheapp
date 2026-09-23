import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { computeQuoteTotals, recordQuotationEvent } from "@/lib/services/quotations";
import { handleApiError, ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { CustomerRow, QuotationEventRow, QuotationItemRow, QuotationRow } from "@/types/db";

const lineSchema = z.object({
  productVariantId: z.string().trim().optional(),
  productName: z.string().trim().min(1, "Vui lòng nhập tên sản phẩm"),
  description: z.string().trim().optional(),
  unit: z.string().trim().min(1).default("Cái"),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().int().nonnegative().optional(),
  vatPercent: z.number().min(0).max(100).optional(),
});

const updateSchema = z.object({
  customerId: z.string().trim().min(1).optional(),
  customerName: z.string().trim().optional(),
  customerPhone: z.string().trim().optional(),
  customerCompany: z.string().trim().optional(),
  customerAddress: z.string().trim().optional(),
  customerTaxCode: z.string().trim().optional(),
  customerEmail: z.string().trim().optional(),
  quoteDate: z.string().trim().optional(),
  validUntil: z.string().trim().optional().nullable(),
  priceType: z.enum(["RETAIL", "WHOLESALE", "AGENT", "CUSTOM"]).optional(),
  assignedTo: z.string().trim().optional(),
  shippingFee: z.number().int().nonnegative().optional(),
  note: z.string().trim().optional().nullable(),
  items: z.array(lineSchema).min(1, "Báo giá cần ít nhất 1 sản phẩm"),
});

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/quotations/[id]">) {
  try {
    await requireRole("ADMIN");
    const { id } = await ctx.params;
    const db = getDb();

    const quotation = await db.prepare(`SELECT * FROM quotations WHERE id = ?`).bind(id).first<QuotationRow>();
    if (!quotation) throw new NotFoundError("Không tìm thấy báo giá");

    const [{ results: items }, { results: events }] = await Promise.all([
      db
        .prepare(`SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order ASC`)
        .bind(id)
        .all<QuotationItemRow>(),
      db
        .prepare(`SELECT * FROM quotation_events WHERE quotation_id = ? ORDER BY created_at ASC`)
        .bind(id)
        .all<QuotationEventRow>(),
    ]);

    return NextResponse.json({ quotation, items, events });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/quotations/[id]">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }
    const data = parsed.data;

    const db = getDb();
    const existing = await db.prepare(`SELECT * FROM quotations WHERE id = ?`).bind(id).first<QuotationRow>();
    if (!existing) throw new NotFoundError("Không tìm thấy báo giá");
    if (existing.status === "CONVERTED") {
      throw new ConflictError("Báo giá đã chuyển thành đơn hàng — không thể sửa nữa");
    }

    const customerId = data.customerId || existing.customer_id;
    let customer: CustomerRow | null = null;
    if (customerId) {
      customer = await db.prepare(`SELECT * FROM customers WHERE id = ? AND is_deleted = 0`).bind(customerId).first<CustomerRow>();
      if (!customer) throw new NotFoundError("Không tìm thấy khách hàng");
    }

    const totals = computeQuoteTotals(
      data.items.map((i) => ({
        productVariantId: i.productVariantId || null,
        productName: i.productName,
        description: i.description || null,
        unit: i.unit,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discountPercent: i.discountPercent,
        discountAmount: i.discountAmount,
        vatPercent: i.vatPercent,
      })),
      data.shippingFee ?? existing.shipping_fee
    );

    await db
      .prepare(
        `UPDATE quotations SET
           customer_id = ?, customer_name_snapshot = ?, customer_phone_snapshot = ?, customer_company_snapshot = ?,
           customer_address_snapshot = ?, customer_tax_code_snapshot = ?, customer_email_snapshot = ?,
           quote_date = ?, valid_until = ?, price_type = ?, assigned_to = ?, shipping_fee = ?, note = ?,
           subtotal = ?, discount_amount = ?, vat_amount = ?, total_amount = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(
        customerId,
        data.customerName || customer?.name || existing.customer_name_snapshot,
        data.customerPhone || customer?.phone || existing.customer_phone_snapshot,
        data.customerCompany || customer?.company_name || existing.customer_company_snapshot,
        data.customerAddress || customer?.address || existing.customer_address_snapshot,
        data.customerTaxCode || customer?.tax_code || existing.customer_tax_code_snapshot,
        data.customerEmail || customer?.email || existing.customer_email_snapshot,
        data.quoteDate || existing.quote_date,
        data.validUntil === undefined ? existing.valid_until : data.validUntil,
        data.priceType || existing.price_type,
        data.assignedTo || existing.assigned_to,
        data.shippingFee ?? existing.shipping_fee,
        data.note === undefined ? existing.note : data.note,
        totals.subtotal,
        totals.discountAmount,
        totals.vatAmount,
        totals.totalAmount,
        id
      )
      .run();

    await db.prepare(`DELETE FROM quotation_items WHERE quotation_id = ?`).bind(id).run();
    await db.batch(
      totals.items.map((item, idx) =>
        db
          .prepare(
            `INSERT INTO quotation_items
               (id, quotation_id, product_variant_id, product_name, description, unit, quantity, unit_price,
                discount_percent, discount_amount, vat_percent, line_total, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            newId(),
            id,
            item.productVariantId || null,
            item.productName,
            item.description || null,
            item.unit,
            item.quantity,
            item.unitPrice,
            item.discountPercent,
            item.discountAmount,
            item.vatPercent,
            item.lineTotal,
            idx
          )
      )
    );

    await recordQuotationEvent(db, { quotationId: id, action: "EDITED", userId: session.user.id });

    await writeAuditLog({ userId: session.user.id, action: "UPDATE_QUOTATION", entity: "quotation", entityId: id });

    const quotation = await db.prepare(`SELECT * FROM quotations WHERE id = ?`).bind(id).first();
    return NextResponse.json({ quotation });
  } catch (err) {
    return handleApiError(err);
  }
}
