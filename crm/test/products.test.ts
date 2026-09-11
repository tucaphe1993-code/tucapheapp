import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb } from "./d1-shim";
import { variantsHaveHistory } from "@/lib/services/products";

let db: D1Database;
let productId: string;
let variantId: string;

beforeEach(async () => {
  db = createTestDb();
  productId = randomUUID();
  variantId = randomUUID();

  await db
    .prepare(`INSERT INTO products (id, name, slug, code, product_type) VALUES (?, 'Tay pha', 'tay-pha', 'TP', 'ACCESSORY')`)
    .bind(productId)
    .run();
  await db
    .prepare(
      `INSERT INTO product_variants (id, product_id, sku, unit, unit_price, cost_price) VALUES (?, ?, 'TP-SKU', 'Cái', 200000, 100000)`
    )
    .bind(variantId, productId)
    .run();
  // Every SKU gets an `inventory` row on creation even with zero real activity —
  // this alone must NOT count as "history".
  await db
    .prepare(`INSERT INTO inventory (id, product_variant_id, sku, quantity_on_hand) VALUES (?, ?, 'TP-SKU', 0)`)
    .bind(randomUUID(), variantId)
    .run();
});

describe("variantsHaveHistory", () => {
  it("returns false for an empty id list and for a brand-new SKU with only its own inventory row", async () => {
    expect(await variantsHaveHistory(db, [])).toBe(false);
    expect(await variantsHaveHistory(db, [variantId])).toBe(false);
  });

  it("returns true once the SKU has a customer-specific price", async () => {
    const customerId = randomUUID();
    await db.prepare(`INSERT INTO customers (id, name) VALUES (?, 'KH Test')`).bind(customerId).run();
    await db
      .prepare(`INSERT INTO customer_prices (id, customer_id, product_variant_id, unit_price) VALUES (?, ?, ?, 180000)`)
      .bind(randomUUID(), customerId, variantId)
      .run();
    expect(await variantsHaveHistory(db, [variantId])).toBe(true);
  });

  it("returns true once the SKU has appeared in a real order", async () => {
    const customerId = randomUUID();
    const userId = randomUUID();
    const orderId = randomUUID();
    await db.prepare(`INSERT INTO customers (id, name) VALUES (?, 'KH Test')`).bind(customerId).run();
    await db
      .prepare(
        `INSERT INTO users (id, email, full_name, password_hash, password_salt, role) VALUES (?, ?, ?, 'x', 'y', 'ADMIN')`
      )
      .bind(userId, "admin@test.local", "Admin Test")
      .run();
    await db
      .prepare(`INSERT INTO orders (id, order_code, customer_id, status, total_amount, created_by) VALUES (?, 'DH-0001', ?, 'CONFIRMED', 200000, ?)`)
      .bind(orderId, customerId, userId)
      .run();
    await db
      .prepare(
        `INSERT INTO order_items (id, order_id, product_variant_id, sku, product_name, quantity, unit_price, line_total)
         VALUES (?, ?, ?, 'TP-SKU', 'Tay pha', 1, 200000, 200000)`
      )
      .bind(randomUUID(), orderId, variantId)
      .run();
    expect(await variantsHaveHistory(db, [variantId])).toBe(true);
  });
});
