import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { newId, nextQuoteCode } from "@/lib/db/id";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { computeQuoteTotals, recordQuotationEvent } from "@/lib/services/quotations";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { CustomerRow, QuotationRow } from "@/types/db";

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

const createSchema = z.object({
  customerId: z.string().trim().min(1, "Vui lòng chọn khách hàng"),
  customerName: z.string().trim().optional(),
  customerPhone: z.string().trim().optional(),
  customerCompany: z.string().trim().optional(),
  customerAddress: z.string().trim().optional(),
  customerTaxCode: z.string().trim().optional(),
  customerEmail: z.string().trim().optional(),
  quoteDate: z.string().trim().optional(),
  validUntil: z.string().trim().optional(),
  priceType: z.enum(["RETAIL", "WHOLESALE", "AGENT", "CUSTOM"]).default("RETAIL"),
  assignedTo: z.string().trim().optional(),
  shippingFee: z.number().int().nonnegative().optional(),
  note: z.string().trim().optional(),
  items: z.array(lineSchema).min(1, "Báo giá cần ít nhất 1 sản phẩm"),
});

export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN");
    const db = getDb();
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status");
    const customerId = sp.get("customerId");
    const from = sp.get("from");
    const to = sp.get("to");
    const q = sp.get("q")?.trim();

    const conditions: string[] = [];
    const args: unknown[] = [];
    if (status) {
      conditions.push("qt.status = ?");
      args.push(status);
    }
    if (customerId) {
      conditions.push("qt.customer_id = ?");
      args.push(customerId);
    }
    if (from) {
      conditions.push("qt.quote_date >= ?");
      args.push(from);
    }
    if (to) {
      conditions.push("qt.quote_date <= ?");
      args.push(to);
    }
    if (q) {
      conditions.push("(qt.quote_code LIKE ? OR qt.customer_name_snapshot LIKE ? OR qt.customer_phone_snapshot LIKE ?)");
      args.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const stmt = db
      .prepare(`SELECT qt.* FROM quotations qt ${where} ORDER BY qt.created_at DESC LIMIT 200`)
      .bind(...args);
    const { results } = await stmt.all<QuotationRow>();
    return NextResponse.json({ quotations: results });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole("ADMIN");
    const json = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }
    const data = parsed.data;

    const db = getDb();
    const customer = await db
      .prepare(`SELECT * FROM customers WHERE id = ? AND is_deleted = 0`)
      .bind(data.customerId)
      .first<CustomerRow>();
    if (!customer) throw new NotFoundError("Không tìm thấy khách hàng");

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
      data.shippingFee ?? 0
    );

    const quoteId = newId();
    const quoteCode = await nextQuoteCode(db);
    const quoteDate = data.quoteDate || new Date().toISOString().slice(0, 10);

    await db
      .prepare(
        `INSERT INTO quotations
           (id, quote_code, customer_id, customer_name_snapshot, customer_phone_snapshot, customer_company_snapshot,
            customer_address_snapshot, customer_tax_code_snapshot, customer_email_snapshot, quote_date, valid_until,
            price_type, status, subtotal, discount_amount, vat_amount, shipping_fee, total_amount, note,
            public_token, assigned_to, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        quoteId,
        quoteCode,
        customer.id,
        data.customerName || customer.name,
        data.customerPhone || customer.phone,
        data.customerCompany || customer.company_name,
        data.customerAddress || customer.address,
        data.customerTaxCode || customer.tax_code,
        data.customerEmail || customer.email,
        quoteDate,
        data.validUntil || null,
        data.priceType,
        totals.subtotal,
        totals.discountAmount,
        totals.vatAmount,
        data.shippingFee ?? 0,
        totals.totalAmount,
        data.note || null,
        newId(),
        data.assignedTo || session.user.id,
        session.user.id
      )
      .run();

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
            quoteId,
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

    await recordQuotationEvent(db, { quotationId: quoteId, action: "CREATED", userId: session.user.id });

    await writeAuditLog({
      userId: session.user.id,
      action: "CREATE_QUOTATION",
      entity: "quotation",
      entityId: quoteId,
      metadata: { quoteCode, totalAmount: totals.totalAmount },
    });

    const quotation = await db.prepare(`SELECT * FROM quotations WHERE id = ?`).bind(quoteId).first();
    return NextResponse.json({ quotation }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
