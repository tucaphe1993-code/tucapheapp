import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb } from "./d1-shim";
import { receiveDevices, sellDevice, releaseDevice, changeDeviceStatus } from "@/lib/services/devices";

let db: D1Database;
let userId: string;
let customerId: string;
let productId: string;
let variantId: string;

beforeEach(async () => {
  db = createTestDb();
  userId = randomUUID();
  customerId = randomUUID();
  productId = randomUUID();
  variantId = randomUUID();

  await db
    .prepare(
      `INSERT INTO users (id, email, full_name, password_hash, password_salt, role) VALUES (?, ?, ?, 'x', 'y', 'ADMIN')`
    )
    .bind(userId, "admin@test.local", "Admin Test")
    .run();
  await db.prepare(`INSERT INTO customers (id, name) VALUES (?, 'Test Customer')`).bind(customerId).run();
  await db
    .prepare(`INSERT INTO products (id, name, slug, code, product_type) VALUES (?, 'LAMVITA 2 GROUP', 'lamvita-2-group', 'LAM', 'BREWER')`)
    .bind(productId)
    .run();
  await db
    .prepare(
      `INSERT INTO product_variants (id, product_id, sku, unit, unit_price, cost_price, requires_serial, warranty_months)
       VALUES (?, ?, 'LAM-2GRP', 'Máy', 45000000, 30000000, 1, 24)`
    )
    .bind(variantId, productId)
    .run();
});

async function seedOrder() {
  const orderId = randomUUID();
  const orderItemId = randomUUID();
  await db
    .prepare(
      `INSERT INTO orders (id, order_code, customer_id, status, total_amount, created_by) VALUES (?, ?, ?, 'CONFIRMED', 45000000, ?)`
    )
    .bind(orderId, `DH-TEST-${orderId.slice(0, 6)}`, customerId, userId)
    .run();
  await db
    .prepare(
      `INSERT INTO order_items (id, order_id, product_variant_id, sku, product_name, quantity, unit_price, line_total)
       VALUES (?, ?, ?, 'LAM-2GRP', 'LAMVITA 2 GROUP', 1, 45000000, 45000000)`
    )
    .bind(orderItemId, orderId, variantId)
    .run();
  return { orderId, orderItemId };
}

describe("receiveDevices", () => {
  it("creates one device row per Serial and rejects the SKU's own duplicate", async () => {
    const devices = await receiveDevices(
      { productId, productVariantId: variantId, serials: ["LM001", "LM002"], createdBy: userId },
      db
    );
    expect(devices).toHaveLength(2);
    const { results } = await db.prepare(`SELECT * FROM devices WHERE product_variant_id = ?`).bind(variantId).all();
    expect(results).toHaveLength(2);

    await expect(
      receiveDevices({ productId, productVariantId: variantId, serials: ["LM001"], createdBy: userId }, db)
    ).rejects.toThrow(/LM001/);
  });

  it("rejects receiving devices for a SKU that isn't Serial-tracked", async () => {
    const nonSerialVariantId = randomUUID();
    await db
      .prepare(
        `INSERT INTO product_variants (id, product_id, sku, unit, unit_price, cost_price, requires_serial)
         VALUES (?, ?, 'LAM-FILTER', 'Cái', 50000, 30000, 0)`
      )
      .bind(nonSerialVariantId, productId)
      .run();
    await expect(
      receiveDevices({ productId, productVariantId: nonSerialVariantId, serials: ["X1"], createdBy: userId }, db)
    ).rejects.toThrow();
  });
});

describe("sellDevice / releaseDevice", () => {
  it("marks a device SOLD and links it to the order, then releases it back on cancel", async () => {
    const [device] = await receiveDevices(
      { productId, productVariantId: variantId, serials: ["LM001"], createdBy: userId },
      db
    );
    const { orderId, orderItemId } = await seedOrder();

    await sellDevice({ deviceId: device.id, orderId, orderItemId, customerId, createdBy: userId }, db);

    const sold = await db.prepare(`SELECT * FROM devices WHERE id = ?`).bind(device.id).first<{
      status: string;
      order_id: string;
      customer_id: string;
    }>();
    expect(sold?.status).toBe("SOLD");
    expect(sold?.order_id).toBe(orderId);
    expect(sold?.customer_id).toBe(customerId);

    await releaseDevice({ deviceId: device.id, createdBy: userId }, db);
    const released = await db.prepare(`SELECT * FROM devices WHERE id = ?`).bind(device.id).first<{
      status: string;
      order_id: string | null;
    }>();
    expect(released?.status).toBe("IN_STOCK");
    expect(released?.order_id).toBeNull();

    // created_at has 1-second resolution — order by rowid too so a fast
    // sequence of events within the same second still sorts by insertion.
    const { results: history } = await db
      .prepare(`SELECT * FROM device_history WHERE device_id = ? ORDER BY created_at ASC, rowid ASC`)
      .bind(device.id)
      .all();
    expect(history.map((h) => (h as { event_type: string }).event_type)).toEqual(["RECEIVE", "SELL", "RELEASE"]);
  });

  it("refuses to sell a device that is no longer in stock (double-booking guard)", async () => {
    const [device] = await receiveDevices(
      { productId, productVariantId: variantId, serials: ["LM001"], createdBy: userId },
      db
    );
    const { orderId, orderItemId } = await seedOrder();
    await sellDevice({ deviceId: device.id, orderId, orderItemId, customerId, createdBy: userId }, db);

    const { orderId: orderId2, orderItemId: orderItemId2 } = await seedOrder();
    await expect(
      sellDevice(
        { deviceId: device.id, orderId: orderId2, orderItemId: orderItemId2, customerId, createdBy: userId },
        db
      )
    ).rejects.toThrow();
  });
});

describe("changeDeviceStatus", () => {
  it("updates status and records the transition in device_history", async () => {
    const [device] = await receiveDevices(
      { productId, productVariantId: variantId, serials: ["LM001"], createdBy: userId },
      db
    );
    await changeDeviceStatus({ deviceId: device.id, toStatus: "IN_REPAIR", note: "Hỏng bơm", createdBy: userId }, db);
    const updated = await db.prepare(`SELECT * FROM devices WHERE id = ?`).bind(device.id).first<{ status: string }>();
    expect(updated?.status).toBe("IN_REPAIR");

    const last = await db
      .prepare(`SELECT * FROM device_history WHERE device_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1`)
      .bind(device.id)
      .first<{ from_status: string; to_status: string }>();
    expect(last?.from_status).toBe("IN_STOCK");
    expect(last?.to_status).toBe("IN_REPAIR");
  });
});
