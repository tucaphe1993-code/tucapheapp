import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb } from "./d1-shim";
import { createPurchaseOrderDraft, confirmPurchaseOrder, deletePurchaseOrderDraft } from "@/lib/services/purchasing";
import { createSupplier } from "@/lib/services/suppliers";

let db: D1Database;
let userId: string;
let variantId: string;
let supplierId: string;

beforeEach(async () => {
  db = createTestDb();
  userId = randomUUID();
  await db
    .prepare(`INSERT INTO users (id, email, full_name, password_hash, password_salt, role) VALUES (?, ?, ?, 'x', 'y', 'ADMIN')`)
    .bind(userId, "admin@test.local", "Admin Test")
    .run();

  const productId = randomUUID();
  await db
    .prepare(`INSERT INTO products (id, name, slug, code, product_type) VALUES (?, 'Giấy in nhiệt', 'giay-in-nhiet', 'GIN', 'ACCESSORY')`)
    .bind(productId)
    .run();
  variantId = randomUUID();
  await db
    .prepare(`INSERT INTO product_variants (id, product_id, sku, unit, unit_price, cost_price) VALUES (?, ?, 'HH001', 'CUON', 32000, 23500)`)
    .bind(variantId, productId)
    .run();
  await db
    .prepare(`INSERT INTO inventory (id, product_variant_id, sku, quantity_on_hand, low_stock_threshold) VALUES (?, ?, 'HH001', 0, 10)`)
    .bind(randomUUID(), variantId)
    .run();

  const supplier = await createSupplier({ name: "Công ty Giấy ABC" }, db);
  supplierId = supplier.id;
});

describe("Mã nhà cung cấp tự sinh", () => {
  it("bắt đầu từ NCC000, tăng dần", async () => {
    const s1 = await createSupplier({ name: "NCC 1" }, db);
    expect(s1.code).toBe("NCC001");
    const s2 = await createSupplier({ name: "NCC 2" }, db);
    expect(s2.code).toBe("NCC002");
  });
});

describe("Đơn mua — nháp chưa đụng tồn kho, xác nhận mới nhập kho + phát sinh công nợ", () => {
  it("tạo nháp: tính đúng tổng tiền, chưa đổi tồn kho", async () => {
    const po = await createPurchaseOrderDraft(
      { supplierId, items: [{ productVariantId: variantId, quantity: 100, unitCost: 23500 }], createdBy: userId },
      db
    );
    expect(po.status).toBe("DRAFT");
    expect(po.total_amount).toBe(2350000);
    expect(po.po_code).toBe("MH-0001");

    const inv = await db.prepare(`SELECT quantity_on_hand FROM inventory WHERE product_variant_id = ?`).bind(variantId).first<{ quantity_on_hand: number }>();
    expect(inv?.quantity_on_hand).toBe(0);
  });

  it("xác nhận: nhập kho đúng số lượng, tạo giao dịch RECEIVE tham chiếu đơn mua", async () => {
    const po = await createPurchaseOrderDraft(
      { supplierId, items: [{ productVariantId: variantId, quantity: 100, unitCost: 23500 }], createdBy: userId },
      db
    );
    await confirmPurchaseOrder(po.id, userId, db);

    const inv = await db.prepare(`SELECT quantity_on_hand FROM inventory WHERE product_variant_id = ?`).bind(variantId).first<{ quantity_on_hand: number }>();
    expect(inv?.quantity_on_hand).toBe(100);

    const tx = await db
      .prepare(`SELECT * FROM inventory_transactions WHERE reference_type = 'PURCHASE_ORDER' AND reference_id = ?`)
      .bind(po.id)
      .first<{ type: string; quantity: number }>();
    expect(tx?.type).toBe("RECEIVE");
    expect(tx?.quantity).toBe(100);
  });

  it("không cho xác nhận 2 lần cho cùng 1 đơn mua (double-submit protection)", async () => {
    const po = await createPurchaseOrderDraft(
      { supplierId, items: [{ productVariantId: variantId, quantity: 100, unitCost: 23500 }], createdBy: userId },
      db
    );
    await confirmPurchaseOrder(po.id, userId, db);
    await expect(confirmPurchaseOrder(po.id, userId, db)).rejects.toThrow();

    const inv = await db.prepare(`SELECT quantity_on_hand FROM inventory WHERE product_variant_id = ?`).bind(variantId).first<{ quantity_on_hand: number }>();
    expect(inv?.quantity_on_hand).toBe(100); // vẫn chỉ +100, không nhân đôi
  });

  it("xóa được nháp chưa xác nhận, không xóa được đơn đã xác nhận", async () => {
    const draft = await createPurchaseOrderDraft(
      { supplierId, items: [{ productVariantId: variantId, quantity: 10, unitCost: 23500 }], createdBy: userId },
      db
    );
    await deletePurchaseOrderDraft(draft.id, db);
    const gone = await db.prepare(`SELECT id FROM purchase_orders WHERE id = ?`).bind(draft.id).first();
    expect(gone).toBeNull();

    const confirmed = await createPurchaseOrderDraft(
      { supplierId, items: [{ productVariantId: variantId, quantity: 10, unitCost: 23500 }], createdBy: userId },
      db
    );
    await confirmPurchaseOrder(confirmed.id, userId, db);
    await expect(deletePurchaseOrderDraft(confirmed.id, db)).rejects.toThrow();
  });

  it("SKU quản lý Serial: xác nhận thiếu/sai số Serial thì báo lỗi, KHÔNG đổi trạng thái đơn", async () => {
    const brewerProductId = randomUUID();
    await db
      .prepare(`INSERT INTO products (id, name, slug, code, product_type) VALUES (?, 'Máy pha CRM3200', 'may-pha-crm3200', 'CRM3200', 'BREWER')`)
      .bind(brewerProductId)
      .run();
    const brewerVariantId = randomUUID();
    await db
      .prepare(
        `INSERT INTO product_variants (id, product_id, sku, unit, unit_price, cost_price, requires_serial)
         VALUES (?, ?, 'CRM3200', 'Cái', 12000000, 8500000, 1)`
      )
      .bind(brewerVariantId, brewerProductId)
      .run();

    const po = await createPurchaseOrderDraft(
      { supplierId, items: [{ productVariantId: brewerVariantId, quantity: 2, unitCost: 8500000 }], createdBy: userId },
      db
    );

    // Không gửi Serial nào — phải báo lỗi và đơn vẫn ở trạng thái DRAFT.
    await expect(confirmPurchaseOrder(po.id, userId, db)).rejects.toThrow();
    const stillDraft = await db.prepare(`SELECT status FROM purchase_orders WHERE id = ?`).bind(po.id).first<{ status: string }>();
    expect(stillDraft?.status).toBe("DRAFT");

    const item = await db.prepare(`SELECT id FROM purchase_order_items WHERE purchase_order_id = ?`).bind(po.id).first<{ id: string }>();

    // Nhập thiếu số Serial (1 thay vì 2) — vẫn báo lỗi.
    await expect(
      confirmPurchaseOrder(po.id, userId, db, { [item!.id]: ["SN-001"] })
    ).rejects.toThrow();

    // Nhập đủ 2 Serial — xác nhận thành công, tạo đúng 2 thiết bị IN_STOCK.
    const confirmed = await confirmPurchaseOrder(po.id, userId, db, { [item!.id]: ["SN-001", "SN-002"] });
    expect(confirmed.status).toBe("CONFIRMED");

    const { results: devices } = await db
      .prepare(`SELECT * FROM devices WHERE product_variant_id = ?`)
      .bind(brewerVariantId)
      .all<{ serial_number: string; status: string; cost_price: number; supplier: string | null }>();
    expect(devices).toHaveLength(2);
    expect(devices.map((d) => d.serial_number).sort()).toEqual(["SN-001", "SN-002"]);
    expect(devices.every((d) => d.status === "IN_STOCK")).toBe(true);
    expect(devices[0].cost_price).toBe(8500000);
    expect(devices[0].supplier).toBe("Công ty Giấy ABC");

    // SKU quản lý Serial không đụng vào bảng inventory (không có dòng tồn kho theo số lượng).
    const inv = await db.prepare(`SELECT id FROM inventory WHERE product_variant_id = ?`).bind(brewerVariantId).first();
    expect(inv).toBeNull();
  });

  it("tính đúng VAT 8%: cộng vào tổng tiền, lưu lại % và số tiền thuế", async () => {
    const po = await createPurchaseOrderDraft(
      { supplierId, vatPercent: 8, items: [{ productVariantId: variantId, quantity: 100, unitCost: 23500 }], createdBy: userId },
      db
    );
    expect(po.vat_percent).toBe(8);
    expect(po.vat_amount).toBe(188000); // 2.350.000 * 8%
    expect(po.total_amount).toBe(2538000); // 2.350.000 + 188.000
  });

  it("cho phép số lượng thập phân cho SKU tồn theo kg lẻ (nhân xanh)", async () => {
    const greenProductId = randomUUID();
    await db
      .prepare(`INSERT INTO products (id, name, slug, code, product_type, coffee_stage) VALUES (?, 'Nhân xanh', 'nhan-xanh', 'NX', 'COFFEE', 'GREEN')`)
      .bind(greenProductId)
      .run();
    const greenVariantId = randomUUID();
    await db
      .prepare(`INSERT INTO product_variants (id, product_id, sku, unit, unit_price, cost_price) VALUES (?, ?, 'NX-HONEY', 'Kg', 0, 106000)`)
      .bind(greenVariantId, greenProductId)
      .run();
    await db
      .prepare(`INSERT INTO inventory (id, product_variant_id, sku, quantity_on_hand, low_stock_threshold) VALUES (?, ?, 'NX-HONEY', 0, 10)`)
      .bind(randomUUID(), greenVariantId)
      .run();

    const po = await createPurchaseOrderDraft(
      { supplierId, items: [{ productVariantId: greenVariantId, quantity: 18.5, unitCost: 106000 }], createdBy: userId },
      db
    );
    await confirmPurchaseOrder(po.id, userId, db);
    const inv = await db.prepare(`SELECT quantity_on_hand FROM inventory WHERE product_variant_id = ?`).bind(greenVariantId).first<{ quantity_on_hand: number }>();
    expect(inv?.quantity_on_hand).toBe(18.5);
  });
});
