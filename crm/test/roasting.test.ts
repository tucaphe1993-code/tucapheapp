import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb } from "./d1-shim";
import { computeRoastCost, createRoastBatchDraft, confirmRoastBatch, getRoastCostConfig } from "@/lib/services/roasting";
import { receiveInventory } from "@/lib/services/inventory";

let db: D1Database;
let userId: string;
let greenProductId: string;
let greenVariantId: string;
let roastedProductId: string;
let roastedVariantId: string;

async function makeProduct(coffeeStage: "GREEN" | "ROASTED", code: string) {
  const id = randomUUID();
  await db
    .prepare(`INSERT INTO products (id, name, slug, code, product_type, coffee_stage) VALUES (?, ?, ?, ?, 'COFFEE', ?)`)
    .bind(id, code, code.toLowerCase(), code, coffeeStage)
    .run();
  return id;
}

async function makeVariant(productId: string, sku: string, unitPrice: number, costPrice: number) {
  const id = randomUUID();
  await db
    .prepare(
      `INSERT INTO product_variants (id, product_id, sku, unit, unit_price, cost_price)
       VALUES (?, ?, ?, 'Kg', ?, ?)`
    )
    .bind(id, productId, sku, unitPrice, costPrice)
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

  greenProductId = await makeProduct("GREEN", "NX");
  greenVariantId = await makeVariant(greenProductId, "NX-HONEY", 0, 106000);
  roastedProductId = await makeProduct("ROASTED", "CR");
  roastedVariantId = await makeVariant(roastedProductId, "CR-HONEY", 0, 0);
});

describe("computeRoastCost", () => {
  it("khớp đúng ví dụ trong spec: giá nhân xanh 106.000đ/kg, hao hụt 20%", () => {
    const config = {
      id: 1,
      default_shrinkage_percent: 20,
      gas_cost_per_kg_green: 1700,
      packaging_cost_per_kg_finished: 5000,
      labor_cost_mode: "PER_KG_FINISHED" as const,
      labor_cost_value: 0,
      other_cost_per_kg_finished: 0,
      updated_at: "",
      updated_by: null,
    };
    const result = computeRoastCost({
      inputKg: 100,
      shrinkagePercent: 20,
      greenCostPricePerKg: 106000,
      config,
    });
    expect(result.finishedKg).toBe(80);
    expect(result.shrinkageKg).toBe(20);
    // 106,000 * 1.25 = 132,500 ; gas 1,700 * 1.25 = 2,125 ; packaging 5,000/kg thành phẩm * 80kg = 400,000
    // cost_per_kg = (132,500*100 hmm — greenBeanCost là TỔNG cho cả mẻ, không phải /kg) — kiểm tra qua costPerKg:
    expect(result.costPerKg).toBe(139625); // 132,500 + 2,125 + 5,000 đúng như ví dụ spec
  });
});

describe("Test Case 1: Nhập 500kg nhân xanh", () => {
  it("stock = 500kg, không có hao hụt", async () => {
    await receiveInventory({ productVariantId: greenVariantId, quantity: 500, createdBy: userId }, db);
    const inv = await db
      .prepare(`SELECT quantity_on_hand FROM inventory WHERE product_variant_id = ?`)
      .bind(greenVariantId)
      .first<{ quantity_on_hand: number }>();
    expect(inv?.quantity_on_hand).toBe(500);
  });
});

describe("Test Case 2: Rang 100kg, hao hụt 20%", () => {
  it("green -100kg, roasted +80kg, shrinkage 20kg — chỉ áp dụng khi CONFIRMED", async () => {
    await receiveInventory({ productVariantId: greenVariantId, quantity: 500, createdBy: userId }, db);

    const draft = await createRoastBatchDraft(
      { greenVariantId, roastedVariantId, inputKg: 100, shrinkagePercent: 20, createdBy: userId },
      db
    );
    expect(draft.status).toBe("DRAFT");
    expect(draft.finished_kg).toBe(80);
    expect(draft.shrinkage_kg).toBe(20);

    // DRAFT chưa được đụng tới tồn kho.
    const greenBeforeConfirm = await db
      .prepare(`SELECT quantity_on_hand FROM inventory WHERE product_variant_id = ?`)
      .bind(greenVariantId)
      .first<{ quantity_on_hand: number }>();
    expect(greenBeforeConfirm?.quantity_on_hand).toBe(500);

    await confirmRoastBatch(draft.id, userId, db);

    const green = await db
      .prepare(`SELECT quantity_on_hand FROM inventory WHERE product_variant_id = ?`)
      .bind(greenVariantId)
      .first<{ quantity_on_hand: number }>();
    expect(green?.quantity_on_hand).toBe(400); // 500 - 100

    const roasted = await db
      .prepare(`SELECT quantity_on_hand FROM inventory WHERE product_variant_id = ?`)
      .bind(roastedVariantId)
      .first<{ quantity_on_hand: number }>();
    expect(roasted?.quantity_on_hand).toBe(80);
  });

  it("không cho xác nhận 2 lần cho cùng 1 mẻ (double-submit protection)", async () => {
    await receiveInventory({ productVariantId: greenVariantId, quantity: 500, createdBy: userId }, db);
    const draft = await createRoastBatchDraft(
      { greenVariantId, roastedVariantId, inputKg: 100, shrinkagePercent: 20, createdBy: userId },
      db
    );
    await confirmRoastBatch(draft.id, userId, db);
    await expect(confirmRoastBatch(draft.id, userId, db)).rejects.toThrow();

    const roasted = await db
      .prepare(`SELECT quantity_on_hand FROM inventory WHERE product_variant_id = ?`)
      .bind(roastedVariantId)
      .first<{ quantity_on_hand: number }>();
    expect(roasted?.quantity_on_hand).toBe(80); // vẫn chỉ +80kg, không nhân đôi
  });

  it("từ chối tạo mẻ rang khi không đủ tồn nhân xanh", async () => {
    await receiveInventory({ productVariantId: greenVariantId, quantity: 50, createdBy: userId }, db);
    await expect(
      createRoastBatchDraft(
        { greenVariantId, roastedVariantId, inputKg: 100, shrinkagePercent: 20, createdBy: userId },
        db
      )
    ).rejects.toThrow(/Không đủ tồn nhân xanh/);
  });
});

describe("Test Case 3: Bán 20kg cà phê rang", () => {
  it("chỉ trừ roasted stock, không đụng tới green stock", async () => {
    await receiveInventory({ productVariantId: greenVariantId, quantity: 500, createdBy: userId }, db);
    const draft = await createRoastBatchDraft(
      { greenVariantId, roastedVariantId, inputKg: 100, shrinkagePercent: 20, createdBy: userId },
      db
    );
    await confirmRoastBatch(draft.id, userId, db);

    // "Bán" ở đây mô phỏng bằng adjustInventory âm (Giai đoạn 2 mới nối vào luồng Order thật).
    const { adjustInventory } = await import("@/lib/services/inventory");
    await adjustInventory({ productVariantId: roastedVariantId, delta: -20, createdBy: userId, note: "Bán hàng" }, db);

    const roasted = await db
      .prepare(`SELECT quantity_on_hand FROM inventory WHERE product_variant_id = ?`)
      .bind(roastedVariantId)
      .first<{ quantity_on_hand: number }>();
    expect(roasted?.quantity_on_hand).toBe(60); // 80 - 20

    const green = await db
      .prepare(`SELECT quantity_on_hand FROM inventory WHERE product_variant_id = ?`)
      .bind(greenVariantId)
      .first<{ quantity_on_hand: number }>();
    expect(green?.quantity_on_hand).toBe(400); // không đổi
  });
});

describe("Test Case 12: Dashboard sản lượng khả dụng", () => {
  it("300kg nhân xanh, hao hụt mặc định 20% => 240kg cà phê rang có thể sản xuất", async () => {
    await receiveInventory({ productVariantId: greenVariantId, quantity: 300, createdBy: userId }, db);
    const config = await getRoastCostConfig(db);
    const green = await db
      .prepare(`SELECT quantity_on_hand FROM inventory WHERE product_variant_id = ?`)
      .bind(greenVariantId)
      .first<{ quantity_on_hand: number }>();
    const capacity = (green?.quantity_on_hand ?? 0) * (1 - config.default_shrinkage_percent / 100);
    expect(capacity).toBe(240);
  });
});

describe("Số lượng thập phân cho nhân xanh (BULK_WEIGHT)", () => {
  it("cho phép nhập 3.5kg lẻ, không bị làm tròn", async () => {
    await receiveInventory({ productVariantId: greenVariantId, quantity: 3.5, createdBy: userId }, db);
    const inv = await db
      .prepare(`SELECT quantity_on_hand FROM inventory WHERE product_variant_id = ?`)
      .bind(greenVariantId)
      .first<{ quantity_on_hand: number }>();
    expect(inv?.quantity_on_hand).toBe(3.5);
  });
});
