import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb } from "./d1-shim";
import { createProtocolFromOrder } from "@/lib/services/protocols";
import { receiveDevices, sellDevice } from "@/lib/services/devices";

let db: D1Database;
let userId: string;
let customerId: string;
let brewerProductId: string;
let brewerVariantId: string;
let grinderProductId: string;
let grinderVariantId: string;
let accessoryProductId: string;
let accessoryVariantId: string;
let orderId: string;

beforeEach(async () => {
  db = createTestDb();
  userId = randomUUID();
  customerId = randomUUID();

  await db
    .prepare(
      `INSERT INTO users (id, email, full_name, password_hash, password_salt, role) VALUES (?, ?, ?, 'x', 'y', 'ADMIN')`
    )
    .bind(userId, "admin@test.local", "Admin Test")
    .run();
  await db.prepare(`INSERT INTO customers (id, name, phone, address) VALUES (?, 'KH Test', '0900000000', '123 Test St')`).bind(customerId).run();

  brewerProductId = randomUUID();
  brewerVariantId = randomUUID();
  await db
    .prepare(`INSERT INTO products (id, name, slug, code, product_type) VALUES (?, 'LAMVITA GO', 'lamvita-go', 'LGO', 'BREWER')`)
    .bind(brewerProductId)
    .run();
  await db
    .prepare(
      `INSERT INTO product_variants (id, product_id, sku, model, unit, unit_price, cost_price, requires_serial, warranty_months)
       VALUES (?, ?, 'LGO-SKU', 'LAMVITA GO', 'Máy', 20000000, 14000000, 1, 12)`
    )
    .bind(brewerVariantId, brewerProductId)
    .run();

  grinderProductId = randomUUID();
  grinderVariantId = randomUUID();
  await db
    .prepare(`INSERT INTO products (id, name, slug, code, product_type) VALUES (?, 'LAMVITA MX', 'lamvita-mx', 'LMX', 'GRINDER')`)
    .bind(grinderProductId)
    .run();
  await db
    .prepare(
      `INSERT INTO product_variants (id, product_id, sku, model, unit, unit_price, cost_price, requires_serial, warranty_months)
       VALUES (?, ?, 'LMX-SKU', 'LAMVITA MX', 'Máy', 15000000, 10000000, 1, 12)`
    )
    .bind(grinderVariantId, grinderProductId)
    .run();

  accessoryProductId = randomUUID();
  accessoryVariantId = randomUUID();
  await db
    .prepare(`INSERT INTO products (id, name, slug, code, product_type) VALUES (?, 'Tay pha', 'tay-pha', 'ACC', 'ACCESSORY')`)
    .bind(accessoryProductId)
    .run();
  await db
    .prepare(
      `INSERT INTO product_variants (id, product_id, sku, unit, unit_price, cost_price)
       VALUES (?, ?, 'ACC-SKU', 'Cái', 200000, 100000)`
    )
    .bind(accessoryVariantId, accessoryProductId)
    .run();

  const [brewerDevice] = await receiveDevices(
    { productId: brewerProductId, productVariantId: brewerVariantId, serials: ["GO-001"], createdBy: userId },
    db
  );
  const [grinderDevice] = await receiveDevices(
    { productId: grinderProductId, productVariantId: grinderVariantId, serials: ["MX-001"], createdBy: userId },
    db
  );

  orderId = randomUUID();
  await db
    .prepare(
      `INSERT INTO orders (id, order_code, customer_id, customer_phone_snapshot, customer_address_snapshot, status, total_amount, created_by)
       VALUES (?, 'DH-0001', ?, '0900000000', '123 Test St', 'CONFIRMED', 35200000, ?)`
    )
    .bind(orderId, customerId, userId)
    .run();

  const brewerItemId = randomUUID();
  await db
    .prepare(
      `INSERT INTO order_items (id, order_id, product_variant_id, sku, product_name, quantity, unit_price, line_total, device_id)
       VALUES (?, ?, ?, 'LGO-SKU', 'LAMVITA GO', 1, 20000000, 20000000, ?)`
    )
    .bind(brewerItemId, orderId, brewerVariantId, brewerDevice.id)
    .run();
  await sellDevice({ deviceId: brewerDevice.id, orderId, orderItemId: brewerItemId, customerId, createdBy: userId }, db);

  const grinderItemId = randomUUID();
  await db
    .prepare(
      `INSERT INTO order_items (id, order_id, product_variant_id, sku, product_name, quantity, unit_price, line_total, device_id)
       VALUES (?, ?, ?, 'LMX-SKU', 'LAMVITA MX', 1, 15000000, 15000000, ?)`
    )
    .bind(grinderItemId, orderId, grinderVariantId, grinderDevice.id)
    .run();
  await sellDevice({ deviceId: grinderDevice.id, orderId, orderItemId: grinderItemId, customerId, createdBy: userId }, db);

  await db
    .prepare(
      `INSERT INTO order_items (id, order_id, product_variant_id, sku, product_name, quantity, unit_price, line_total)
       VALUES (?, ?, ?, 'ACC-SKU', 'Tay pha', 1, 200000, 200000)`
    )
    .bind(randomUUID(), orderId, accessoryVariantId)
    .run();
});

describe("createProtocolFromOrder", () => {
  it("pulls every device line, every accessory line, and generates both checklists", async () => {
    const { id: protocolId, created } = await createProtocolFromOrder({ orderId, createdBy: userId }, db);
    expect(created).toBe(true);

    const protocol = await db
      .prepare(`SELECT * FROM handover_protocols WHERE id = ?`)
      .bind(protocolId)
      .first<{ protocol_code: string; contact_name: string; install_address: string; status: string }>();
    expect(protocol?.protocol_code).toMatch(/^BB-\d{4}$/);
    expect(protocol?.contact_name).toBe("KH Test");
    expect(protocol?.install_address).toBe("123 Test St");
    expect(protocol?.status).toBe("PENDING_INSTALL");

    const { results: devices } = await db
      .prepare(`SELECT * FROM handover_protocol_devices WHERE protocol_id = ? ORDER BY sort_order ASC`)
      .bind(protocolId)
      .all<{ product_name: string; serial_number: string }>();
    expect(devices.map((d) => d.product_name)).toEqual(["LAMVITA GO", "LAMVITA MX"]);
    expect(devices.map((d) => d.serial_number)).toEqual(["GO-001", "MX-001"]);

    const { results: accessories } = await db
      .prepare(`SELECT name, quantity FROM handover_protocol_accessories WHERE protocol_id = ?`)
      .bind(protocolId)
      .all<{ name: string; quantity: number }>();
    expect(accessories).toEqual([{ name: "Tay pha", quantity: 1 }]);

    const { results: checklist } = await db
      .prepare(`SELECT category FROM handover_protocol_checklist WHERE protocol_id = ?`)
      .bind(protocolId)
      .all<{ category: string }>();
    expect(checklist.filter((c) => c.category === "INSTALL")).toHaveLength(13);
    expect(checklist.filter((c) => c.category === "GUIDE")).toHaveLength(8);
  });

  it("is idempotent — calling it again for the same order returns the existing protocol", async () => {
    const first = await createProtocolFromOrder({ orderId, createdBy: userId }, db);
    const second = await createProtocolFromOrder({ orderId, createdBy: userId }, db);
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);

    const { results } = await db.prepare(`SELECT id FROM handover_protocols WHERE order_id = ?`).bind(orderId).all();
    expect(results).toHaveLength(1);
  });

  it("refuses to create a protocol for an order with no serialized devices", async () => {
    const bareOrderId = randomUUID();
    await db
      .prepare(
        `INSERT INTO orders (id, order_code, customer_id, status, total_amount, created_by) VALUES (?, 'DH-0002', ?, 'CONFIRMED', 200000, ?)`
      )
      .bind(bareOrderId, customerId, userId)
      .run();
    await db
      .prepare(
        `INSERT INTO order_items (id, order_id, product_variant_id, sku, product_name, quantity, unit_price, line_total)
         VALUES (?, ?, ?, 'ACC-SKU', 'Tay pha', 1, 200000, 200000)`
      )
      .bind(randomUUID(), bareOrderId, accessoryVariantId)
      .run();

    await expect(createProtocolFromOrder({ orderId: bareOrderId, createdBy: userId }, db)).rejects.toThrow();
  });
});
