import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb } from "./d1-shim";
import { computeQuoteTotals, convertQuotationToOrder, duplicateQuotation } from "@/lib/services/quotations";
import { nextQuoteCode } from "@/lib/db/id";

describe("computeQuoteTotals", () => {
  it("throws when there are no lines", () => {
    expect(() => computeQuoteTotals([])).toThrow();
  });

  it("throws on non-positive quantity or negative price", () => {
    expect(() =>
      computeQuoteTotals([{ productName: "A", unit: "Cái", quantity: 0, unitPrice: 1000 }])
    ).toThrow();
    expect(() =>
      computeQuoteTotals([{ productName: "A", unit: "Cái", quantity: 1, unitPrice: -1 }])
    ).toThrow();
  });

  it("applies percent discount then VAT on top, and sums shipping into the grand total", () => {
    const totals = computeQuoteTotals(
      [{ productName: "Cà phê Classic", unit: "Kg", quantity: 10, unitPrice: 100000, discountPercent: 10, vatPercent: 8 }],
      20000
    );
    // subtotal 1,000,000 - 10% ck = 900,000; +8% vat = 72,000 -> line total 972,000
    expect(totals.subtotal).toBe(1_000_000);
    expect(totals.discountAmount).toBe(100_000);
    expect(totals.vatAmount).toBe(72_000);
    expect(totals.items[0].lineTotal).toBe(972_000);
    expect(totals.totalAmount).toBe(1_000_000 - 100_000 + 72_000 + 20_000);
  });

  it("prefers flat discountAmount over discountPercent when both are set on a line", () => {
    const totals = computeQuoteTotals([
      { productName: "A", unit: "Cái", quantity: 2, unitPrice: 100_000, discountPercent: 50, discountAmount: 10_000 },
    ]);
    expect(totals.discountAmount).toBe(10_000);
    expect(totals.items[0].discountPercent).toBe(0);
    expect(totals.items[0].lineTotal).toBe(190_000);
  });

  it("clamps a flat discount that exceeds the line subtotal", () => {
    const totals = computeQuoteTotals([{ productName: "A", unit: "Cái", quantity: 1, unitPrice: 50_000, discountAmount: 999_999 }]);
    expect(totals.items[0].discountAmount).toBe(50_000);
    expect(totals.items[0].lineTotal).toBe(0);
  });
});

let db: D1Database;
let userId: string;
let customerId: string;
let productId: string;
let variantId: string;

beforeEach(async () => {
  db = createTestDb();
  userId = randomUUID();
  customerId = randomUUID();

  await db
    .prepare(`INSERT INTO users (id, email, full_name, password_hash, password_salt, role) VALUES (?, ?, ?, 'x', 'y', 'ADMIN')`)
    .bind(userId, "admin@test.local", "Admin Test")
    .run();
  await db
    .prepare(`INSERT INTO customers (id, name, phone, address) VALUES (?, 'KH Báo Giá', '0911111111', '456 Test Ave')`)
    .bind(customerId)
    .run();

  productId = randomUUID();
  variantId = randomUUID();
  await db
    .prepare(`INSERT INTO products (id, name, slug, code, product_type) VALUES (?, 'Cà phê Classic', 'ca-phe-classic', 'CLS', 'COFFEE')`)
    .bind(productId)
    .run();
  await db
    .prepare(
      `INSERT INTO product_variants (id, product_id, sku, form, packaging, weight_grams, unit, unit_price, cost_price)
       VALUES (?, ?, 'CLS-1KG', 'BEAN', 'BAG', 1000, 'Kg', 180000, 120000)`
    )
    .bind(variantId, productId)
    .run();
});

async function insertQuotation(overrides: Partial<{ status: string; customerId: string | null }> = {}) {
  const totals = computeQuoteTotals([
    { productVariantId: variantId, productName: "Cà phê Classic", unit: "Kg", quantity: 5, unitPrice: 180_000 },
  ]);
  const quotationId = randomUUID();
  const code = await nextQuoteCode(db);
  const publicToken = randomUUID();
  await db
    .prepare(
      `INSERT INTO quotations
         (id, quote_code, customer_id, customer_name_snapshot, customer_phone_snapshot, quote_date, status,
          subtotal, discount_amount, vat_amount, total_amount, public_token, created_by)
       VALUES (?, ?, ?, 'KH Báo Giá', '0911111111', date('now'), ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      quotationId,
      code,
      overrides.customerId === undefined ? customerId : overrides.customerId,
      overrides.status ?? "DRAFT",
      totals.subtotal,
      totals.discountAmount,
      totals.vatAmount,
      totals.totalAmount,
      publicToken,
      userId
    )
    .run();
  await db
    .prepare(
      `INSERT INTO quotation_items (id, quotation_id, product_variant_id, product_name, unit, quantity, unit_price, line_total, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
    )
    .bind(randomUUID(), quotationId, variantId, "Cà phê Classic", "Kg", 5, 180_000, totals.totalAmount)
    .run();
  return quotationId;
}

describe("duplicateQuotation", () => {
  it("copies customer/items/prices into a new DRAFT quote without touching the source", async () => {
    const sourceId = await insertQuotation({ status: "SENT" });
    const copy = await duplicateQuotation(db, { quotationId: sourceId, createdBy: userId });

    expect(copy.status).toBe("DRAFT");
    expect(copy.id).not.toBe(sourceId);
    expect(copy.customer_id).toBe(customerId);
    expect(copy.total_amount).toBeGreaterThan(0);

    const { results: items } = await db.prepare(`SELECT * FROM quotation_items WHERE quotation_id = ?`).bind(copy.id).all();
    expect(items).toHaveLength(1);

    const source = await db.prepare(`SELECT status FROM quotations WHERE id = ?`).bind(sourceId).first<{ status: string }>();
    expect(source?.status).toBe("SENT");
  });
});

describe("convertQuotationToOrder", () => {
  it("creates an order with the same customer, items, quantities and totals", async () => {
    const quotationId = await insertQuotation();
    const { order, created } = await convertQuotationToOrder(db, { quotationId, actingUserId: userId });

    expect(created).toBe(true);
    expect(order.customer_id).toBe(customerId);
    expect(order.status).toBe("CONFIRMED");

    const { results: items } = await db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).bind(order.id).all<{
      sku: string;
      product_name: string;
      quantity: number;
      unit_price: number;
    }>();
    expect(items).toHaveLength(1);
    expect(items[0].sku).toBe("CLS-1KG");
    expect(items[0].quantity).toBe(5);
    expect(items[0].unit_price).toBe(180_000);

    const quotation = await db.prepare(`SELECT status, converted_order_id FROM quotations WHERE id = ?`).bind(quotationId).first<{
      status: string;
      converted_order_id: string;
    }>();
    expect(quotation?.status).toBe("CONVERTED");
    expect(quotation?.converted_order_id).toBe(order.id);

    const { results: events } = await db.prepare(`SELECT action FROM quotation_events WHERE quotation_id = ?`).bind(quotationId).all<{
      action: string;
    }>();
    expect(events.some((e) => e.action === "CONVERTED")).toBe(true);
  });

  it("never creates a duplicate order when converted twice", async () => {
    const quotationId = await insertQuotation();
    const first = await convertQuotationToOrder(db, { quotationId, actingUserId: userId });
    const second = await convertQuotationToOrder(db, { quotationId, actingUserId: userId });

    expect(second.created).toBe(false);
    expect(second.order.id).toBe(first.order.id);

    const { results: orders } = await db.prepare(`SELECT id FROM orders WHERE customer_id = ?`).bind(customerId).all();
    expect(orders).toHaveLength(1);
  });

  it("refuses to convert a quotation with no linked customer", async () => {
    const quotationId = await insertQuotation({ customerId: null });
    await expect(convertQuotationToOrder(db, { quotationId, actingUserId: userId })).rejects.toThrow();
  });
});
