import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { newId, nextOrderCode } from "@/lib/db/id";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { CustomerRow, OrderRow, ProductVariantRow } from "@/types/db";

const createSchema = z.object({
  customerId: z.string().min(1),
  deliveryDate: z.string().trim().optional(),
  deliveryMethod: z.string().trim().optional(),
  note: z.string().trim().optional(),
  items: z
    .array(
      z.object({
        productVariantId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .min(1, "Đơn hàng cần ít nhất 1 sản phẩm"),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireRole("ADMIN", "EMPLOYEE");
    const db = getDb();
    const status = req.nextUrl.searchParams.get("status");

    // Employees only see orders tied to a task assigned to them (spec §4).
    if (session.user.role === "EMPLOYEE") {
      const { results } = await db
        .prepare(
          `SELECT DISTINCT o.* FROM orders o
           JOIN tasks t ON t.order_id = o.id
           WHERE t.assigned_to = ?
           ORDER BY o.created_at DESC`
        )
        .bind(session.user.id)
        .all<OrderRow>();
      return NextResponse.json({ orders: results });
    }

    const stmt = status
      ? db
          .prepare(`SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT 200`)
          .bind(status)
      : db.prepare(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 200`);
    const { results } = await stmt.all<OrderRow>();
    return NextResponse.json({ orders: results });
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
    const { customerId, deliveryDate, deliveryMethod, note, items } = parsed.data;

    const db = getDb();
    const customer = await db
      .prepare(`SELECT * FROM customers WHERE id = ? AND is_deleted = 0`)
      .bind(customerId)
      .first<CustomerRow>();
    if (!customer) throw new NotFoundError("Không tìm thấy khách hàng");

    type ResolvedItem = {
      productVariantId: string;
      quantity: number;
      sku: string;
      productName: string;
      form: string;
      packaging: string;
      weightGrams: number;
      unitPrice: number;
      lineTotal: number;
    };
    const resolvedItems: ResolvedItem[] = [];
    let totalAmount = 0;

    for (const item of items) {
      const variant = await db
        .prepare(
          `SELECT pv.*, p.name as product_name FROM product_variants pv
           JOIN products p ON p.id = pv.product_id
           WHERE pv.id = ? AND pv.is_active = 1`
        )
        .bind(item.productVariantId)
        .first<ProductVariantRow & { product_name: string }>();
      if (!variant) {
        throw new ValidationError(`Không tìm thấy SKU cho sản phẩm đã chọn`);
      }
      // Price is ALWAYS taken from the DB, never trusted from the client.
      const lineTotal = variant.unit_price * item.quantity;
      totalAmount += lineTotal;
      resolvedItems.push({
        productVariantId: variant.id,
        quantity: item.quantity,
        sku: variant.sku,
        productName: variant.product_name,
        form: variant.form,
        packaging: variant.packaging,
        weightGrams: variant.weight_grams,
        unitPrice: variant.unit_price,
        lineTotal,
      });
    }

    const orderId = newId();
    const orderCode = await nextOrderCode(db);

    await db
      .prepare(
        `INSERT INTO orders
           (id, order_code, customer_id, customer_phone_snapshot, customer_address_snapshot,
            delivery_date, delivery_method, note, status, total_amount, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?)`
      )
      .bind(
        orderId,
        orderCode,
        customer.id,
        customer.phone,
        customer.address,
        deliveryDate || null,
        deliveryMethod || null,
        note || null,
        totalAmount,
        session.user.id
      )
      .run();

    await db.batch(
      resolvedItems.map((item) =>
        db
          .prepare(
            `INSERT INTO order_items
               (id, order_id, product_variant_id, sku, product_name, form, packaging, weight_grams, quantity, unit_price, line_total)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            newId(),
            orderId,
            item.productVariantId,
            item.sku,
            item.productName,
            item.form,
            item.packaging,
            item.weightGrams,
            item.quantity,
            item.unitPrice,
            item.lineTotal
          )
      )
    );

    await writeAuditLog({
      userId: session.user.id,
      action: "CREATE_ORDER",
      entity: "order",
      entityId: orderId,
      metadata: { orderCode, totalAmount },
    });

    const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first();
    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
