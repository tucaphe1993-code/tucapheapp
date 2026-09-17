import { getDb } from "@/lib/db/client";
import { newId, nextPurchaseOrderCode } from "@/lib/db/id";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import { isBulkWeightProduct } from "@/lib/constants";
import { receiveDevices } from "@/lib/services/devices";
import type { PurchaseOrderRow, PurchaseOrderItemRow } from "@/types/db";

export interface PurchaseOrderLineInput {
  productVariantId: string;
  quantity: number;
  unitCost: number;
}

/**
 * Tạo đơn mua (nháp) — nhiều dòng hàng, CHƯA đụng tồn kho, CHƯA phát sinh
 * công nợ. Giống hệt nguyên tắc "DRAFT chưa ảnh hưởng gì" đã áp dụng cho
 * mẻ rang/đơn bán trước đây trong hệ thống.
 */
export async function createPurchaseOrderDraft(
  params: {
    supplierId: string;
    paymentMethodCode?: string;
    note?: string;
    vatPercent?: number;
    items: PurchaseOrderLineInput[];
    createdBy: string;
  },
  db: D1Database = getDb()
): Promise<PurchaseOrderRow> {
  if (params.items.length === 0) throw new ValidationError("Đơn mua phải có ít nhất 1 dòng hàng");

  const supplier = await db
    .prepare(`SELECT id FROM suppliers WHERE id = ? AND is_deleted = 0`)
    .bind(params.supplierId)
    .first();
  if (!supplier) throw new NotFoundError("Không tìm thấy nhà cung cấp");

  const lines: (PurchaseOrderLineInput & { sku: string; productName: string; lineTotal: number })[] = [];
  let totalAmount = 0;
  for (const item of params.items) {
    if (item.quantity <= 0) throw new ValidationError("Số lượng mua phải lớn hơn 0");
    if (item.unitCost < 0) throw new ValidationError("Đơn giá mua không hợp lệ");

    const variant = await db
      .prepare(
        `SELECT pv.sku, p.name as product_name, p.product_type, p.coffee_stage FROM product_variants pv
         JOIN products p ON p.id = pv.product_id
         WHERE pv.id = ?`
      )
      .bind(item.productVariantId)
      .first<{ sku: string; product_name: string; product_type: string; coffee_stage: string | null }>();
    if (!variant) throw new NotFoundError(`Không tìm thấy SKU trong đơn mua`);

    if (!Number.isInteger(item.quantity) && !isBulkWeightProduct(variant.product_type, variant.coffee_stage)) {
      throw new ValidationError(`SKU ${variant.sku}: số lượng phải là số nguyên`);
    }

    const lineTotal = Math.round(item.unitCost * item.quantity);
    totalAmount += lineTotal;
    lines.push({ ...item, sku: variant.sku, productName: variant.product_name, lineTotal });
  }

  const vatPercent = params.vatPercent ?? 0;
  const vatAmount = Math.round((totalAmount * vatPercent) / 100);
  totalAmount += vatAmount;

  const id = newId();
  const poCode = await nextPurchaseOrderCode(db);

  await db.batch([
    db
      .prepare(
        `INSERT INTO purchase_orders
           (id, po_code, supplier_id, status, payment_method_code, note, total_amount, vat_percent, vat_amount, created_by)
         VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        poCode,
        params.supplierId,
        params.paymentMethodCode ?? null,
        params.note ?? null,
        totalAmount,
        vatPercent,
        vatAmount,
        params.createdBy
      ),
    ...lines.map((l) =>
      db
        .prepare(
          `INSERT INTO purchase_order_items
             (id, purchase_order_id, product_variant_id, sku, product_name, quantity, unit_cost, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(newId(), id, l.productVariantId, l.sku, l.productName, l.quantity, l.unitCost, l.lineTotal)
    ),
  ]);

  const po = await db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).bind(id).first<PurchaseOrderRow>();
  return po!;
}

export async function deletePurchaseOrderDraft(id: string, db: D1Database = getDb()): Promise<void> {
  const po = await db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).bind(id).first<PurchaseOrderRow>();
  if (!po) throw new NotFoundError("Không tìm thấy đơn mua");
  if (po.status !== "DRAFT") throw new ValidationError("Chỉ được xóa đơn mua ở trạng thái nháp");
  await db.batch([
    db.prepare(`DELETE FROM purchase_order_items WHERE purchase_order_id = ?`).bind(id),
    db.prepare(`DELETE FROM purchase_orders WHERE id = ? AND status = 'DRAFT'`).bind(id),
  ]);
}

/**
 * Xác nhận đơn mua: nhập kho TẤT CẢ các dòng hàng (RECEIVE) + phát sinh
 * công nợ phải trả NCC — đúng 1 lần duy nhất (compare-and-set trên
 * status='DRAFT', giống hệt issueInventoryForOrder/confirmRoastBatch).
 *
 * SKU quản lý Serial (máy/thiết bị) không có dòng trong bảng inventory —
 * phải nhập đúng số Serial (bằng số lượng đã mua) cho từng dòng hàng này
 * qua serialsByItemId (key = purchase_order_item.id) thì mới tạo được
 * thiết bị (devices) tương ứng — nếu không "hàng hóa" sẽ không xuất hiện
 * ở đâu cả (không có Serial thì không có thiết bị để bán/lắp đặt).
 */
export async function confirmPurchaseOrder(
  id: string,
  actingUserId: string,
  db: D1Database = getDb(),
  serialsByItemId: Record<string, string[]> = {}
): Promise<PurchaseOrderRow> {
  const po = await db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).bind(id).first<PurchaseOrderRow>();
  if (!po) throw new NotFoundError("Không tìm thấy đơn mua");
  if (po.status !== "DRAFT") throw new ConflictError("Đơn mua này đã được xác nhận hoặc đã hủy trước đó");

  const { results: items } = await db
    .prepare(
      `SELECT poi.*, pv.requires_serial, pv.product_id FROM purchase_order_items poi
       JOIN product_variants pv ON pv.id = poi.product_variant_id
       WHERE poi.purchase_order_id = ?`
    )
    .bind(id)
    .all<PurchaseOrderItemRow & { requires_serial: number; product_id: string }>();

  // Kiểm tra đủ Serial cho các dòng quản lý Serial TRƯỚC KHI đổi trạng thái —
  // tránh xác nhận "cụt" (đơn đã CONFIRMED nhưng thiếu thiết bị vì thiếu Serial).
  for (const item of items) {
    if (item.requires_serial) {
      const serials = serialsByItemId[item.id] ?? [];
      if (serials.length !== item.quantity) {
        throw new ValidationError(
          `SKU ${item.sku}: cần nhập đúng ${item.quantity} số Serial (đã nhập ${serials.length})`
        );
      }
    }
  }

  const cas = await db
    .prepare(
      `UPDATE purchase_orders SET status = 'CONFIRMED', inventory_received_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ? AND status = 'DRAFT'`
    )
    .bind(id)
    .run();
  if (!cas.meta.changes) {
    throw new ConflictError("Đơn mua này đã được xác nhận trước đó (double-submit)");
  }

  const supplier = await db
    .prepare(`SELECT name FROM suppliers WHERE id = ?`)
    .bind(po.supplier_id)
    .first<{ name: string }>();

  const normalItems = items.filter((item) => !item.requires_serial);
  const serialItems = items.filter((item) => item.requires_serial);

  const statements = normalItems.flatMap((item) => [
    db
      .prepare(
        `INSERT INTO inventory_transactions
           (id, product_variant_id, sku, quantity, type, reference_type, reference_id, created_by, note)
         VALUES (?, ?, ?, ?, 'RECEIVE', 'PURCHASE_ORDER', ?, ?, ?)`
      )
      .bind(newId(), item.product_variant_id, item.sku, item.quantity, id, actingUserId, `Nhập kho đơn mua ${po.po_code}`),
    db
      .prepare(
        `UPDATE inventory SET quantity_on_hand = quantity_on_hand + ?, updated_at = datetime('now')
         WHERE product_variant_id = ?`
      )
      .bind(item.quantity, item.product_variant_id),
  ]);
  if (statements.length > 0) await db.batch(statements);

  for (const item of serialItems) {
    await receiveDevices(
      {
        productId: item.product_id,
        productVariantId: item.product_variant_id,
        serials: serialsByItemId[item.id],
        supplier: supplier?.name,
        costPrice: item.unit_cost,
        createdBy: actingUserId,
      },
      db
    );
  }

  const updated = await db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).bind(id).first<PurchaseOrderRow>();
  return updated!;
}

export async function cancelPurchaseOrder(id: string, db: D1Database = getDb()): Promise<void> {
  const po = await db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).bind(id).first<PurchaseOrderRow>();
  if (!po) throw new NotFoundError("Không tìm thấy đơn mua");
  if (po.status !== "DRAFT") throw new ValidationError("Chỉ được hủy đơn mua ở trạng thái nháp");
  await db
    .prepare(`UPDATE purchase_orders SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ? AND status = 'DRAFT'`)
    .bind(id)
    .run();
}
