import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb } from "./d1-shim";
import { receiveInventory, sellFinishedCoffee } from "@/lib/services/inventory";

let db: D1Database;
let userId: string;
let greenVariantId: string;
let finishedVariantId: string;

async function makeProduct(coffeeStage: "GREEN" | "ROASTED", code: string) {
  const id = randomUUID();
  await db
    .prepare(`INSERT INTO products (id, name, slug, code, product_type, coffee_stage) VALUES (?, ?, ?, ?, 'COFFEE', ?)`)
    .bind(id, code, code.toLowerCase(), code, coffeeStage)
    .run();
  return id;
}

async function makeVariant(productId: string, sku: string, unitPrice: number, sourceGreenVariantId?: string) {
  const id = randomUUID();
  await db
    .prepare(
      `INSERT INTO product_variants (id, product_id, sku, unit, unit_price, cost_price, source_green_variant_id)
       VALUES (?, ?, ?, 'Kg', ?, 0, ?)`
    )
    .bind(id, productId, sku, unitPrice, sourceGreenVariantId ?? null)
    .run();
  await db
    .prepare(
      `INSERT INTO inventory (id, product_variant_id, sku, quantity_on_hand, low_stock_threshold)
       VALUES (?, ?, ?, 0, 10)`
    )
    .bind(randomUUID(), id, sku)
    .run();
  return id;
}

beforeEach(async () => {
  db = createTestDb();
  userId = randomUUID();
  await db
    .prepare(
      `INSERT INTO users (id, email, full_name, password_hash, password_salt, role) VALUES (?, ?, ?, 'x', 'y', 'ADMIN')`
    )
    .bind(userId, "admin@test.local", "Admin Test")
    .run();

  const greenProductId = await makeProduct("GREEN", "NX");
  greenVariantId = await makeVariant(greenProductId, "NX-HONEY", 106000);
  const roastedProductId = await makeProduct("ROASTED", "CR");
  finishedVariantId = await makeVariant(roastedProductId, "CR-HONEY", 200000, greenVariantId);

  // Cấu hình hao hụt mặc định 20% (đã có sẵn giá trị mặc định 20 từ migration).
  await receiveInventory({ productVariantId: greenVariantId, quantity: 500, createdBy: userId }, db);
});

async function greenStock() {
  const row = await db
    .prepare(`SELECT quantity_on_hand FROM inventory WHERE product_variant_id = ?`)
    .bind(greenVariantId)
    .first<{ quantity_on_hand: number }>();
  return row?.quantity_on_hand ?? 0;
}

describe("Bán hàng — tự quy đổi ngược ra nhân xanh (hao hụt 20% => tỷ lệ 0.8)", () => {
  it("bán 20kg thành phẩm => tiêu hao 25kg nhân xanh, tồn 500kg -> 475kg", async () => {
    const result = await sellFinishedCoffee(
      { finishedVariantId, finishedKg: 20, createdBy: userId },
      db
    );
    expect(result.greenKgConsumed).toBe(25);
    expect(await greenStock()).toBe(475);
  });

  it("bán 40kg thành phẩm => tiêu hao 50kg nhân xanh", async () => {
    const result = await sellFinishedCoffee(
      { finishedVariantId, finishedKg: 40, createdBy: userId },
      db
    );
    expect(result.greenKgConsumed).toBe(50);
    expect(await greenStock()).toBe(450);
  });

  it("chỉ tạo đúng 1 giao dịch SALE cho mỗi lần bán (không nhân đôi)", async () => {
    await sellFinishedCoffee({ finishedVariantId, finishedKg: 20, createdBy: userId }, db);
    const { results } = await db.prepare(`SELECT * FROM inventory_transactions WHERE type = 'SALE'`).all();
    expect(results.length).toBe(1);
  });

  it("từ chối bán khi không đủ tồn nhân xanh, không trừ tồn", async () => {
    await expect(
      sellFinishedCoffee({ finishedVariantId, finishedKg: 1000, createdBy: userId }, db)
    ).rejects.toThrow(/Không đủ tồn nhân xanh/);
    expect(await greenStock()).toBe(500);
  });

  it("VAT không ảnh hưởng tới số kg nhân xanh tiêu hao hay tồn kho, chỉ ảnh hưởng tiền", async () => {
    const withoutVat = await sellFinishedCoffee(
      { finishedVariantId, finishedKg: 10, createdBy: userId, unitPrice: 200000 },
      db
    );
    const withVat = await sellFinishedCoffee(
      { finishedVariantId, finishedKg: 10, createdBy: userId, unitPrice: 200000, vatIncluded: true, vatPercent: 8 },
      db
    );
    expect(withVat.greenKgConsumed).toBe(withoutVat.greenKgConsumed);
    expect(withVat.lineTotal).toBe(Math.round(200000 * 10 * 1.08));
    expect(withoutVat.lineTotal).toBe(200000 * 10);
  });

  it("từ chối bán SKU thành phẩm chưa cấu hình nguyên liệu nhân xanh nguồn", async () => {
    const productId = await makeProduct("ROASTED", "CR2");
    const orphanVariantId = await makeVariant(productId, "CR2-HONEY", 200000);
    await expect(
      sellFinishedCoffee({ finishedVariantId: orphanVariantId, finishedKg: 10, createdBy: userId }, db)
    ).rejects.toThrow(/chưa được cấu hình/);
  });
});

describe("Nhập hàng — lưu vết hóa đơn đầu vào (không ảnh hưởng công thức tồn kho)", () => {
  it("lưu nhà cung cấp/số hóa đơn/đơn giá kèm giao dịch RECEIVE", async () => {
    await receiveInventory(
      {
        productVariantId: greenVariantId,
        quantity: 100,
        createdBy: userId,
        supplier: "Nông trại Honey",
        invoiceNumber: "HD-001",
        invoiceDate: "2026-09-14",
        unitPrice: 106000,
      },
      db
    );
    const tx = await db
      .prepare(`SELECT * FROM inventory_transactions WHERE type = 'RECEIVE' AND supplier = 'Nông trại Honey'`)
      .first<{ supplier: string; invoice_number: string; invoice_date: string; unit_price: number }>();
    expect(tx?.supplier).toBe("Nông trại Honey");
    expect(tx?.invoice_number).toBe("HD-001");
    expect(tx?.unit_price).toBe(106000);
    expect(await greenStock()).toBe(600);
  });
});
