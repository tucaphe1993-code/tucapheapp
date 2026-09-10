import { getDb } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { InventoryRow, OrderItemRow, OrderRow } from "@/types/db";

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
 */
export async function issueInventoryForOrder(
  orderId: string,
  actingUserId: string,
  db: D1Database = getDb()
): Promise<{ order: OrderRow }> {
  const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first<OrderRow>();
  if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");
  if (order.status !== "PACKED") {
    throw new ConflictError("Đơn phải ở trạng thái ĐÃ ĐÓNG GÓI mới được xuất kho");
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
  const cas = await db
    .prepare(
      `UPDATE orders SET status = 'SHIPPED', inventory_issued_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ? AND status = 'PACKED' AND inventory_issued_at IS NULL`
    )
    .bind(orderId)
    .run();
  if (!cas.meta.changes) {
    throw new ConflictError("Đơn hàng này đã được xuất kho trước đó (double-submit)");
  }

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

export async function receiveInventory(
  params: {
    productVariantId: string;
    quantity: number;
    createdBy: string;
    note?: string;
  },
  db: D1Database = getDb()
) {
  if (params.quantity <= 0) throw new ValidationError("Số lượng nhập kho phải lớn hơn 0");
  const inv = await db
    .prepare(`SELECT * FROM inventory WHERE product_variant_id = ?`)
    .bind(params.productVariantId)
    .first<InventoryRow>();
  if (!inv) throw new NotFoundError("Không tìm thấy SKU trong kho");

  await db.batch([
    db
      .prepare(
        `INSERT INTO inventory_transactions
           (id, product_variant_id, sku, quantity, type, reference_type, reference_id, created_by, note)
         VALUES (?, ?, ?, ?, 'RECEIVE', 'MANUAL', NULL, ?, ?)`
      )
      .bind(newId(), params.productVariantId, inv.sku, params.quantity, params.createdBy, params.note ?? null),
    db
      .prepare(
        `UPDATE inventory SET quantity_on_hand = quantity_on_hand + ?, updated_at = datetime('now')
         WHERE product_variant_id = ?`
      )
      .bind(params.quantity, params.productVariantId),
  ]);
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
