import { getDb } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import { EQUIPMENT_DELIVERY_METHODS, isBulkWeightProduct } from "@/lib/constants";
import { getRoastCostConfig } from "@/lib/services/roasting";
import type { InventoryRow, OrderItemRow, OrderRow, ProductVariantRow } from "@/types/db";

/**
 * Chỉ SKU thuộc nhóm tồn theo KG lẻ (nhân xanh, cà phê rang rời) mới được
 * nhập số lượng thập phân — SKU đóng gói/máy/linh kiện vẫn bắt buộc số
 * nguyên (không có "1.5 túi" hay "1.5 máy").
 */
async function assertValidQuantity(db: D1Database, productVariantId: string, quantity: number) {
  if (Number.isInteger(quantity)) return;
  const row = await db
    .prepare(
      `SELECT p.product_type as product_type, p.coffee_stage as coffee_stage FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE pv.id = ?`
    )
    .bind(productVariantId)
    .first<{ product_type: string; coffee_stage: string | null }>();
  if (!row || !isBulkWeightProduct(row.product_type, row.coffee_stage)) {
    throw new ValidationError("Số lượng phải là số nguyên cho loại sản phẩm này");
  }
}

// Đơn "Khách tự lắp" không cần giao việc đóng gói cho nhân viên (khách tự
// đến lấy) — nên được xuất kho thẳng từ CONFIRMED, không cần đi qua
// PACKING/PACKED như đơn giao hàng thông thường.
const SELF_PICKUP_METHOD = EQUIPMENT_DELIVERY_METHODS[0];

export interface StockShortfall {
  sku: string;
  requested: number;
  available: number;
}

/**
 * Issues stock for a PACKED order (order §19: only ever at SHIPPED time).
 * Idempotent + race-safe:
 *  - the order-level transition is a compare-and-set UPDATE
 *    (`WHERE status='PACKED' AND inventory_issued_at IS NULL`); only the
 *    request that flips it proceeds to touch inventory, so a double
 *    click / double submit is a no-op for the loser.
 *  - each line's ISSUE transaction also carries a partial UNIQUE index on
 *    (reference_type, reference_id) WHERE type='ISSUE' as a second,
 *    DB-level guard against ever issuing the same order line twice.
 *
 * `direct: true` — lối tắt "Đã giao" của chủ trên TÚ QUICK: cho xuất kho
 * thẳng từ CONFIRMED/PACKING/PACKED (bỏ qua giao việc/đóng gói), vẫn trừ
 * kho, chống bấm 2 lần và hủy task đóng gói dang dở y như luồng thường.
 */
const DIRECT_SHIP_STATUSES: OrderRow["status"][] = ["CONFIRMED", "PACKING", "PACKED"];

export async function issueInventoryForOrder(
  orderId: string,
  actingUserId: string,
  db: D1Database = getDb(),
  options: { direct?: boolean } = {}
): Promise<{ order: OrderRow }> {
  const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first<OrderRow>();
  if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");
  const isSelfPickup = order.delivery_method === SELF_PICKUP_METHOD;
  const canShip = options.direct
    ? DIRECT_SHIP_STATUSES.includes(order.status)
    : order.status === "PACKED" || (isSelfPickup && order.status === "CONFIRMED");
  if (!canShip) {
    throw new ConflictError(
      options.direct
        ? "Chỉ đánh dấu Đã giao được đơn chưa giao (chưa xuất kho, chưa hủy)"
        : "Đơn phải ở trạng thái ĐÃ ĐÓNG GÓI mới được xuất kho"
    );
  }
  if (order.inventory_issued_at) {
    throw new ConflictError("Đơn hàng này đã được xuất kho trước đó");
  }

  const { results: items } = await db
    .prepare(`SELECT * FROM order_items WHERE order_id = ?`)
    .bind(orderId)
    .all<OrderItemRow>();
  if (items.length === 0) throw new ValidationError("Đơn hàng không có sản phẩm");

  const shortfalls: StockShortfall[] = [];
  const inventoryBySku = new Map<string, InventoryRow>();
  for (const item of items) {
    const inv = await db
      .prepare(`SELECT * FROM inventory WHERE product_variant_id = ?`)
      .bind(item.product_variant_id)
      .first<InventoryRow>();
    if (!inv || inv.quantity_on_hand < item.quantity) {
      shortfalls.push({
        sku: item.sku,
        requested: item.quantity,
        available: inv?.quantity_on_hand ?? 0,
      });
    } else {
      inventoryBySku.set(item.id, inv);
    }
  }
  if (shortfalls.length > 0) {
    const err = new ConflictError(
      `Không đủ tồn kho: ${shortfalls
        .map((s) => `${s.sku} (cần ${s.requested}, còn ${s.available})`)
        .join(", ")}`
    );
    (err as ConflictError & { shortfalls: StockShortfall[] }).shortfalls = shortfalls;
    throw err;
  }

  // Compare-and-set: wins the race exactly once.
  const cas = options.direct
    ? await db
        .prepare(
          `UPDATE orders SET status = 'SHIPPED', inventory_issued_at = datetime('now'), updated_at = datetime('now')
           WHERE id = ? AND inventory_issued_at IS NULL AND status IN ('CONFIRMED', 'PACKING', 'PACKED')`
        )
        .bind(orderId)
        .run()
    : await db
        .prepare(
          `UPDATE orders SET status = 'SHIPPED', inventory_issued_at = datetime('now'), updated_at = datetime('now')
           WHERE id = ? AND inventory_issued_at IS NULL
             AND (status = 'PACKED' OR (status = 'CONFIRMED' AND delivery_method = ?))`
        )
        .bind(orderId, SELF_PICKUP_METHOD)
        .run();
  if (!cas.meta.changes) {
    throw new ConflictError("Đơn hàng này đã được xuất kho trước đó (double-submit)");
  }

  // Xuất kho thẳng từ CONFIRMED (đơn "Khách tự lắp") bỏ qua bước giao việc
  // đóng gói — hủy luôn task còn dang dở (nếu admin trót giao việc trước
  // khi đổi ý dùng lối tắt này) để nhân viên không còn thấy việc "ma".
  await db
    .prepare(
      `UPDATE tasks SET status = 'CANCELLED', updated_at = datetime('now')
       WHERE order_id = ? AND status IN ('TODO','IN_PROGRESS')`
    )
    .bind(orderId)
    .run();

  const statements = items.flatMap((item) => [
    db
      .prepare(
        `INSERT INTO inventory_transactions
           (id, product_variant_id, sku, quantity, type, reference_type, reference_id, created_by, note)
         VALUES (?, ?, ?, ?, 'ISSUE', 'ORDER_ITEM', ?, ?, ?)`
      )
      .bind(
        newId(),
        item.product_variant_id,
        item.sku,
        -item.quantity,
        item.id,
        actingUserId,
        `Xuất kho đơn ${order.order_code}`
      ),
    db
      .prepare(
        `UPDATE inventory SET quantity_on_hand = quantity_on_hand - ?, updated_at = datetime('now')
         WHERE product_variant_id = ?`
      )
      .bind(item.quantity, item.product_variant_id),
  ]);
  await db.batch(statements);

  const updated = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first<OrderRow>();
  return { order: updated! };
}

/**
 * Hoàn lại 1 lần bấm "Đã giao"/Xuất kho nhầm: SHIPPED → CONFIRMED, cộng trả
 * đúng số đã trừ và XOÁ các dòng ISSUE của đơn (xuất kho không có thật →
 * báo cáo "Xuất bán" không bị tính sai, và giao lại sau vẫn được vì index
 * UNIQUE "issue once" được giải phóng). Audit log vẫn giữ vết ở tầng API.
 * Compare-and-set trên orders nên bấm 2 lần cũng chỉ cộng trả 1 lần.
 */
export async function reverseInventoryForOrder(
  orderId: string,
  db: D1Database = getDb()
): Promise<{ order: OrderRow; restored: { sku: string; quantity: number }[] }> {
  const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first<OrderRow>();
  if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");
  if (order.status !== "SHIPPED" || !order.inventory_issued_at) {
    throw new ConflictError("Chỉ hoàn lại được đơn đang ở trạng thái ĐÃ GIAO");
  }

  const cas = await db
    .prepare(
      `UPDATE orders SET status = 'CONFIRMED', inventory_issued_at = NULL, updated_at = datetime('now')
       WHERE id = ? AND status = 'SHIPPED' AND inventory_issued_at IS NOT NULL`
    )
    .bind(orderId)
    .run();
  if (!cas.meta.changes) throw new ConflictError("Đơn hàng đã được hoàn lại trước đó (double-submit)");

  const { results: issues } = await db
    .prepare(
      `SELECT t.id, t.product_variant_id, t.sku, t.quantity FROM inventory_transactions t
       JOIN order_items oi ON oi.id = t.reference_id
       WHERE oi.order_id = ? AND t.type = 'ISSUE' AND t.reference_type = 'ORDER_ITEM'`
    )
    .bind(orderId)
    .all<{ id: string; product_variant_id: string; sku: string; quantity: number }>();

  if (issues.length) {
    await db.batch(
      issues.flatMap((t) => [
        db
          .prepare(
            `UPDATE inventory SET quantity_on_hand = quantity_on_hand + ?, updated_at = datetime('now')
             WHERE product_variant_id = ?`
          )
          .bind(-t.quantity, t.product_variant_id),
        db.prepare(`DELETE FROM inventory_transactions WHERE id = ?`).bind(t.id),
      ])
    );
  }

  const updated = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first<OrderRow>();
  return { order: updated!, restored: issues.map((t) => ({ sku: t.sku, quantity: -t.quantity })) };
}

export async function receiveInventory(
  params: {
    productVariantId: string;
    quantity: number;
    createdBy: string;
    note?: string;
    // Nhập hàng (hóa đơn đầu vào) — tất cả đều tùy chọn, chỉ để lưu vết,
    // không ảnh hưởng công thức tồn kho.
    supplier?: string;
    invoiceNumber?: string;
    invoiceDate?: string;
    unitPrice?: number;
  },
  db: D1Database = getDb()
) {
  if (params.quantity <= 0) throw new ValidationError("Số lượng nhập kho phải lớn hơn 0");
  await assertValidQuantity(db, params.productVariantId, params.quantity);
  const inv = await db
    .prepare(`SELECT * FROM inventory WHERE product_variant_id = ?`)
    .bind(params.productVariantId)
    .first<InventoryRow>();
  if (!inv) throw new NotFoundError("Không tìm thấy SKU trong kho");

  await db.batch([
    db
      .prepare(
        `INSERT INTO inventory_transactions
           (id, product_variant_id, sku, quantity, type, reference_type, reference_id, created_by, note,
            supplier, invoice_number, invoice_date, unit_price)
         VALUES (?, ?, ?, ?, 'RECEIVE', 'MANUAL', NULL, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        newId(),
        params.productVariantId,
        inv.sku,
        params.quantity,
        params.createdBy,
        params.note ?? null,
        params.supplier ?? null,
        params.invoiceNumber ?? null,
        params.invoiceDate ?? null,
        params.unitPrice ?? null
      ),
    db
      .prepare(
        `UPDATE inventory SET quantity_on_hand = quantity_on_hand + ?, updated_at = datetime('now')
         WHERE product_variant_id = ?`
      )
      .bind(params.quantity, params.productVariantId),
  ]);
}

export interface SellFinishedCoffeeResult {
  greenVariantId: string;
  greenSku: string;
  greenKgConsumed: number;
  unitPrice: number;
  lineTotal: number;
  vatAmount: number;
}

/**
 * Bán hàng cà phê thành phẩm: KHÔNG có tồn kho thành phẩm riêng — nhập
 * đúng 1 số duy nhất là KG thành phẩm bán ra, hệ thống tự quy đổi ngược
 * ra KG nhân xanh tiêu hao (theo tỷ lệ ở roast_cost_config.
 * default_shrinkage_percent, VD hao hụt 20% => 1kg thành phẩm cần
 * 1/0.8 = 1.25kg nhân xanh) và trừ THẲNG vào tồn nhân xanh trong CÙNG một
 * giao dịch — không qua bước "mẻ rang"/xuất kho riêng nào khác, không thể
 * trừ 2 lần cho cùng 1 lần bán vì mỗi lần gọi luôn tạo giao dịch mới.
 */
export async function sellFinishedCoffee(
  params: {
    finishedVariantId: string;
    finishedKg: number;
    createdBy: string;
    customerId?: string;
    unitPrice?: number;
    vatIncluded?: boolean;
    vatPercent?: number;
    invoiceNumber?: string;
    invoiceDate?: string;
    note?: string;
  },
  db: D1Database = getDb()
): Promise<SellFinishedCoffeeResult> {
  if (params.finishedKg <= 0) throw new ValidationError("Số kg thành phẩm bán phải lớn hơn 0");

  const finished = await db
    .prepare(
      `SELECT pv.*, p.product_type as product_type, p.coffee_stage as coffee_stage FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE pv.id = ?`
    )
    .bind(params.finishedVariantId)
    .first<ProductVariantRow & { product_type: string; coffee_stage: string | null }>();
  if (!finished) throw new NotFoundError("Không tìm thấy SKU cà phê thành phẩm");
  if (finished.product_type !== "COFFEE" || finished.coffee_stage !== "ROASTED") {
    throw new ValidationError("SKU phải thuộc nhóm cà phê rang thành phẩm");
  }
  if (!finished.source_green_variant_id) {
    throw new ValidationError(
      `SKU ${finished.sku} chưa được cấu hình nguyên liệu nhân xanh nguồn — vào Sản phẩm để thiết lập`
    );
  }

  const config = await getRoastCostConfig(db);
  const shrinkagePercent = config.default_shrinkage_percent;
  if (shrinkagePercent < 0 || shrinkagePercent >= 100) {
    throw new ValidationError("Tỷ lệ hao hụt/chuyển đổi đang cấu hình không hợp lệ");
  }
  const ratio = 1 - shrinkagePercent / 100;
  const greenKgConsumed = Math.round((params.finishedKg / ratio) * 1000) / 1000;

  const greenInv = await db
    .prepare(`SELECT * FROM inventory WHERE product_variant_id = ?`)
    .bind(finished.source_green_variant_id)
    .first<InventoryRow>();
  if (!greenInv || greenInv.quantity_on_hand < greenKgConsumed) {
    throw new ConflictError(
      `Không đủ tồn nhân xanh để bán: cần ${greenKgConsumed}kg, còn ${greenInv?.quantity_on_hand ?? 0}kg`
    );
  }

  const greenSku = await db
    .prepare(`SELECT sku FROM product_variants WHERE id = ?`)
    .bind(finished.source_green_variant_id)
    .first<{ sku: string }>();

  const unitPrice = params.unitPrice ?? finished.unit_price;
  const subtotal = Math.round(unitPrice * params.finishedKg);
  const vatPercent = params.vatIncluded ? (params.vatPercent ?? 0) : 0;
  const vatAmount = params.vatIncluded ? Math.round((subtotal * vatPercent) / 100) : 0;
  const lineTotal = subtotal + vatAmount;

  const txId = newId();
  await db.batch([
    db
      .prepare(
        `INSERT INTO inventory_transactions
           (id, product_variant_id, sku, quantity, type, reference_type, reference_id, created_by, note,
            finished_variant_id, finished_kg, customer_id, unit_price, line_total, vat_percent, vat_amount,
            invoice_number, invoice_date)
         VALUES (?, ?, ?, ?, 'SALE', 'SALE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        txId,
        finished.source_green_variant_id,
        greenSku!.sku,
        -greenKgConsumed,
        txId,
        params.createdBy,
        params.note ?? null,
        finished.id,
        params.finishedKg,
        params.customerId ?? null,
        unitPrice,
        lineTotal,
        params.vatIncluded ? vatPercent : null,
        params.vatIncluded ? vatAmount : null,
        params.invoiceNumber ?? null,
        params.invoiceDate ?? null
      ),
    db
      .prepare(
        `UPDATE inventory SET quantity_on_hand = quantity_on_hand - ?, updated_at = datetime('now')
         WHERE product_variant_id = ?`
      )
      .bind(greenKgConsumed, finished.source_green_variant_id),
  ]);

  return {
    greenVariantId: finished.source_green_variant_id,
    greenSku: greenSku!.sku,
    greenKgConsumed,
    unitPrice,
    lineTotal,
    vatAmount,
  };
}

export async function adjustInventory(
  params: {
    productVariantId: string;
    delta: number;
    createdBy: string;
    note: string;
  },
  db: D1Database = getDb()
) {
  if (params.delta === 0) throw new ValidationError("Số lượng điều chỉnh phải khác 0");
  if (!params.note?.trim()) throw new ValidationError("Điều chỉnh tồn kho bắt buộc phải có ghi chú lý do");
  await assertValidQuantity(db, params.productVariantId, params.delta);
  const inv = await db
    .prepare(`SELECT * FROM inventory WHERE product_variant_id = ?`)
    .bind(params.productVariantId)
    .first<InventoryRow>();
  if (!inv) throw new NotFoundError("Không tìm thấy SKU trong kho");
  if (inv.quantity_on_hand + params.delta < 0) {
    throw new ValidationError("Điều chỉnh sẽ làm tồn kho âm — không hợp lệ");
  }

  await db.batch([
    db
      .prepare(
        `INSERT INTO inventory_transactions
           (id, product_variant_id, sku, quantity, type, reference_type, reference_id, created_by, note)
         VALUES (?, ?, ?, ?, 'ADJUSTMENT', 'MANUAL', NULL, ?, ?)`
      )
      .bind(newId(), params.productVariantId, inv.sku, params.delta, params.createdBy, params.note),
    db
      .prepare(
        `UPDATE inventory SET quantity_on_hand = quantity_on_hand + ?, updated_at = datetime('now')
         WHERE product_variant_id = ?`
      )
      .bind(params.delta, params.productVariantId),
  ]);
}
