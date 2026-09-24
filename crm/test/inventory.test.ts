import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb } from "./d1-shim";
import { issueInventoryForOrder, receiveInventory, adjustInventory } from "@/lib/services/inventory";

let db: D1Database;
let userId: string;
let variantId: string;
let sku: string;

async function seedOrder(status: string, quantity: number, deliveryMethod: string | null = null) {
  const orderId = randomUUID();
  const customerId = randomUUID();
  const itemId = randomUUID();

  await db
    .prepare(`INSERT INTO customers (id, name) VALUES (?, ?)`)
    .bind(customerId, "Test Customer")
    .run();
  await db
    .prepare(
      `INSERT INTO orders (id, order_code, customer_id, status, delivery_method, total_amount, created_by)
       VALUES (?, ?, ?, ?, ?, 0, ?)`
    )
    .bind(orderId, `DH-TEST-${orderId.slice(0, 6)}`, customerId, status, deliveryMethod, userId)
    .run();
  await db
    .prepare(
      `INSERT INTO order_items
         (id, order_id, product_variant_id, sku, product_name, form, packaging, weight_grams, quantity, unit_price, line_total)
       VALUES (?, ?, ?, ?, 'Crema Blend', 'HAT', 'TUI_XANH', 500, ?, 140000, ?)`
    )
    .bind(itemId, orderId, variantId, sku, quantity, quantity * 140000)
    .run();

  return orderId;
}

beforeEach(async () => {
  db = createTestDb();
  userId = randomUUID();
  variantId = randomUUID();
  sku = "CB-H-XANH-500";
  const productId = randomUUID();

  await db
    .prepare(
      `INSERT INTO users (id, email, full_name, password_hash, password_salt, role) VALUES (?, ?, ?, 'x', 'y', 'ADMIN')`
    )
    .bind(userId, "admin@test.local", "Admin Test")
    .run();
  await db
    .prepare(`INSERT INTO products (id, name, slug, code) VALUES (?, 'Crema Blend', 'crema-blend', 'CB')`)
    .bind(productId)
    .run();
  await db
    .prepare(
      `INSERT INTO product_variants (id, product_id, form, packaging, weight_grams, sku, unit_price, cost_price)
       VALUES (?, ?, 'HAT', 'TUI_XANH', 500, ?, 140000, 84000)`
    )
    .bind(variantId, productId, sku)
    .run();
  await db
    .prepare(
      `INSERT INTO inventory (id, product_variant_id, sku, quantity_on_hand, low_stock_threshold)
       VALUES (?, ?, ?, 10, 5)`
    )
    .bind(randomUUID(), variantId, sku)
    .run();
});

describe("receiveInventory: số lượng thập phân theo nhóm hàng", () => {
  it("từ chối số lẻ cho SKU thường (cà phê đóng gói, máy...) — chỉ nhóm KG lẻ mới được số thập phân", async () => {
    await expect(
      receiveInventory({ productVariantId: variantId, quantity: 3.5, createdBy: userId }, db)
    ).rejects.toThrow(/số nguyên/);
  });
});

describe("issueInventoryForOrder", () => {
  it("refuses to issue an order that is not yet PACKED", async () => {
    const orderId = await seedOrder("CONFIRMED", 2);
    await expect(issueInventoryForOrder(orderId, userId, db)).rejects.toThrow(/ĐÃ ĐÓNG GÓI/);
  });

  it("decrements stock by the ordered quantity and moves the order to SHIPPED", async () => {
    const orderId = await seedOrder("PACKED", 3);
    const { order } = await issueInventoryForOrder(orderId, userId, db);
    expect(order.status).toBe("SHIPPED");
    expect(order.inventory_issued_at).not.toBeNull();

    const inv = await db
      .prepare(`SELECT quantity_on_hand FROM inventory WHERE product_variant_id = ?`)
      .bind(variantId)
      .first<{ quantity_on_hand: number }>();
    expect(inv?.quantity_on_hand).toBe(7); // 10 - 3
  });

  it("never issues stock twice for the same order (double-submit protection)", async () => {
    const orderId = await seedOrder("PACKED", 3);
    await issueInventoryForOrder(orderId, userId, db);

    await expect(issueInventoryForOrder(orderId, userId, db)).rejects.toThrow();

    const inv = await db
      .prepare(`SELECT quantity_on_hand FROM inventory WHERE product_variant_id = ?`)
      .bind(variantId)
      .first<{ quantity_on_hand: number }>();
    // Still only decremented once, not twice.
    expect(inv?.quantity_on_hand).toBe(7);

    const txCount = await db
      .prepare(`SELECT COUNT(*) as c FROM inventory_transactions WHERE type = 'ISSUE'`)
      .first<{ c: number }>();
    expect(txCount?.c).toBe(1);
  });

  it("allows issuing directly from CONFIRMED when delivery method is Khách tự lắp", async () => {
    const orderId = await seedOrder("CONFIRMED", 2, "Khách tự lắp");
    const { order } = await issueInventoryForOrder(orderId, userId, db);
    expect(order.status).toBe("SHIPPED");

    const inv = await db
      .prepare(`SELECT quantity_on_hand FROM inventory WHERE product_variant_id = ?`)
      .bind(variantId)
      .first<{ quantity_on_hand: number }>();
    expect(inv?.quantity_on_hand).toBe(8); // 10 - 2
  });

  it("cancels any pending packing task when shipping directly from CONFIRMED", async () => {
    const orderId = await seedOrder("CONFIRMED", 2, "Khách tự lắp");
    const taskId = randomUUID();
    await db
      .prepare(
        `INSERT INTO tasks (id, order_id, assigned_to, assigned_by, title, status)
         VALUES (?, ?, ?, ?, 'Đóng gói', 'TODO')`
      )
      .bind(taskId, orderId, userId, userId)
      .run();

    await issueInventoryForOrder(orderId, userId, db);

    const task = await db.prepare(`SELECT status FROM tasks WHERE id = ?`).bind(taskId).first<{ status: string }>();
    expect(task?.status).toBe("CANCELLED");
  });

  it("still refuses CONFIRMED for a normal delivery method (not self-pickup)", async () => {
    const orderId = await seedOrder("CONFIRMED", 2, "Lắp đặt tận nơi");
    await expect(issueInventoryForOrder(orderId, userId, db)).rejects.toThrow(/ĐÃ ĐÓNG GÓI/);
  });

  it("refuses to issue when requested quantity exceeds stock on hand, and changes nothing", async () => {
    const orderId = await seedOrder("PACKED", 999);
    await expect(issueInventoryForOrder(orderId, userId, db)).rejects.toThrow(/Không đủ tồn kho/);

    const order = await db.prepare(`SELECT status FROM orders WHERE id = ?`).bind(orderId).first<{ status: string }>();
    expect(order?.status).toBe("PACKED"); // unchanged

    const inv = await db
      .prepare(`SELECT quantity_on_hand FROM inventory WHERE product_variant_id = ?`)
      .bind(variantId)
      .first<{ quantity_on_hand: number }>();
    expect(inv?.quantity_on_hand).toBe(10); // unchanged
  });
});

describe("issueInventoryForOrder — lối tắt Đã giao (direct, TÚ QUICK)", () => {
  async function stock() {
    const inv = await db
      .prepare(`SELECT quantity_on_hand FROM inventory WHERE product_variant_id = ?`)
      .bind(variantId)
      .first<{ quantity_on_hand: number }>();
    return inv?.quantity_on_hand;
  }

  it("giao thẳng từ CONFIRMED (giao hàng thường), trừ kho, hủy task đóng gói dang dở", async () => {
    const orderId = await seedOrder("CONFIRMED", 3, "Book Ship");
    const taskId = randomUUID();
    await db
      .prepare(`INSERT INTO tasks (id, order_id, assigned_to, assigned_by, title, status) VALUES (?, ?, ?, ?, 'Đóng gói', 'IN_PROGRESS')`)
      .bind(taskId, orderId, userId, userId)
      .run();

    const { order } = await issueInventoryForOrder(orderId, userId, db, { direct: true });
    expect(order.status).toBe("SHIPPED");
    expect(order.inventory_issued_at).toBeTruthy();
    expect(await stock()).toBe(7); // 10 - 3
    const task = await db.prepare(`SELECT status FROM tasks WHERE id = ?`).bind(taskId).first<{ status: string }>();
    expect(task?.status).toBe("CANCELLED");
  });

  it("cũng giao được từ PACKING", async () => {
    const orderId = await seedOrder("PACKING", 1);
    const { order } = await issueInventoryForOrder(orderId, userId, db, { direct: true });
    expect(order.status).toBe("SHIPPED");
  });

  it("không bao giờ trừ kho 2 lần khi bấm Đã giao 2 lần", async () => {
    const orderId = await seedOrder("CONFIRMED", 2);
    await issueInventoryForOrder(orderId, userId, db, { direct: true });
    await expect(issueInventoryForOrder(orderId, userId, db, { direct: true })).rejects.toThrow();
    expect(await stock()).toBe(8);
  });

  it("từ chối đơn đã hủy hoặc đã hoàn thành", async () => {
    for (const status of ["CANCELLED", "COMPLETED", "DRAFT"]) {
      const orderId = await seedOrder(status, 1);
      await expect(issueInventoryForOrder(orderId, userId, db, { direct: true })).rejects.toThrow(/chưa giao/);
    }
    expect(await stock()).toBe(10);
  });

  it("từ chối khi kho không đủ và không đổi gì", async () => {
    const orderId = await seedOrder("CONFIRMED", 50);
    await expect(issueInventoryForOrder(orderId, userId, db, { direct: true })).rejects.toThrow(/Không đủ tồn kho/);
    const order = await db.prepare(`SELECT status FROM orders WHERE id = ?`).bind(orderId).first<{ status: string }>();
    expect(order?.status).toBe("CONFIRMED");
    expect(await stock()).toBe(10);
  });
});

describe("receiveInventory / adjustInventory", () => {
  it("increases stock on RECEIVE", async () => {
    await receiveInventory({ productVariantId: variantId, quantity: 25, createdBy: userId }, db);
    const inv = await db
      .prepare(`SELECT quantity_on_hand FROM inventory WHERE product_variant_id = ?`)
      .bind(variantId)
      .first<{ quantity_on_hand: number }>();
    expect(inv?.quantity_on_hand).toBe(35);
  });

  it("requires a reason note for ADJUSTMENT", async () => {
    await expect(
      adjustInventory({ productVariantId: variantId, delta: -2, createdBy: userId, note: "" }, db)
    ).rejects.toThrow(/ghi chú/);
  });

  it("refuses an ADJUSTMENT that would make stock negative", async () => {
    await expect(
      adjustInventory({ productVariantId: variantId, delta: -100, createdBy: userId, note: "kiểm kê" }, db)
    ).rejects.toThrow(/âm/);
  });

  it("applies a valid ADJUSTMENT and records the transaction", async () => {
    await adjustInventory({ productVariantId: variantId, delta: -4, createdBy: userId, note: "hàng hỏng" }, db);
    const inv = await db
      .prepare(`SELECT quantity_on_hand FROM inventory WHERE product_variant_id = ?`)
      .bind(variantId)
      .first<{ quantity_on_hand: number }>();
    expect(inv?.quantity_on_hand).toBe(6);
  });
});
