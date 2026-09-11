import { getDb } from "@/lib/db/client";
import { newId, nextOrderCode, nowIso } from "@/lib/db/id";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { CustomerRow, DeviceRow, DeviceStatus, ProductVariantRow } from "@/types/db";

export const DEVICE_STATUS_LABEL: Record<DeviceStatus, string> = {
  IN_STOCK: "Trong kho",
  SOLD: "Đã bán",
  AWAITING_INSTALL: "Chờ lắp đặt",
  INSTALLING: "Đang lắp đặt",
  IN_USE: "Đang sử dụng",
  UNDER_WARRANTY: "Đang bảo hành",
  IN_REPAIR: "Đang sửa chữa",
  RECALLED: "Đã thu hồi",
  RETIRED: "Ngừng sử dụng",
};

async function recordDeviceHistory(
  db: D1Database,
  params: {
    deviceId: string;
    eventType: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    orderId?: string | null;
    customerId?: string | null;
    note?: string | null;
    createdBy?: string | null;
  }
) {
  await db
    .prepare(
      `INSERT INTO device_history
         (id, device_id, event_type, from_status, to_status, order_id, customer_id, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      newId(),
      params.deviceId,
      params.eventType,
      params.fromStatus ?? null,
      params.toStatus ?? null,
      params.orderId ?? null,
      params.customerId ?? null,
      params.note ?? null,
      params.createdBy ?? null
    )
    .run();
}

/** Nhập kho hàng loạt Serial cho một SKU máy/thiết bị yêu cầu quản lý Serial. */
export async function receiveDevices(
  params: {
    productId: string;
    productVariantId: string;
    serials: string[];
    supplier?: string;
    costPrice?: number;
    createdBy: string;
  },
  db: D1Database = getDb()
): Promise<DeviceRow[]> {
  const serials = [...new Set(params.serials.map((s) => s.trim()).filter(Boolean))];
  if (serials.length === 0) throw new ValidationError("Vui lòng nhập ít nhất 1 số Serial");
  if (serials.length !== params.serials.length) {
    throw new ValidationError("Danh sách Serial có giá trị trùng hoặc rỗng");
  }

  const variant = await db
    .prepare(`SELECT * FROM product_variants WHERE id = ? AND product_id = ?`)
    .bind(params.productVariantId, params.productId)
    .first<ProductVariantRow>();
  if (!variant) throw new NotFoundError("Không tìm thấy SKU");
  if (!variant.requires_serial) {
    throw new ValidationError("SKU này không được cấu hình quản lý Serial");
  }

  const placeholders = serials.map(() => "?").join(",");
  const { results: existing } = await db
    .prepare(`SELECT serial_number FROM devices WHERE serial_number IN (${placeholders})`)
    .bind(...serials)
    .all<{ serial_number: string }>();
  if (existing.length > 0) {
    throw new ConflictError(`Serial đã tồn tại: ${existing.map((e) => e.serial_number).join(", ")}`);
  }

  const devices: DeviceRow[] = serials.map((serial) => ({
    id: newId(),
    product_id: params.productId,
    product_variant_id: params.productVariantId,
    serial_number: serial,
    status: "IN_STOCK",
    supplier: params.supplier ?? null,
    cost_price: params.costPrice ?? variant.cost_price,
    order_id: null,
    order_item_id: null,
    customer_id: null,
    sold_at: null,
    handed_over_at: null,
    warranty_start_date: null,
    warranty_end_date: null,
    note: null,
    received_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  await db.batch([
    ...devices.map((d) =>
      db
        .prepare(
          `INSERT INTO devices (id, product_id, product_variant_id, serial_number, status, supplier, cost_price)
           VALUES (?, ?, ?, ?, 'IN_STOCK', ?, ?)`
        )
        .bind(d.id, d.product_id, d.product_variant_id, d.serial_number, d.supplier, d.cost_price)
    ),
    ...devices.map((d) =>
      db
        .prepare(
          `INSERT INTO device_history (id, device_id, event_type, to_status, note, created_by)
           VALUES (?, ?, 'RECEIVE', 'IN_STOCK', ?, ?)`
        )
        .bind(newId(), d.id, `Nhập kho serial ${d.serial_number}`, params.createdBy)
    ),
  ]);

  return devices;
}

/** Gán 1 device cụ thể cho 1 dòng đơn hàng (bán máy) — atomic CAS, chặn double-book. */
export async function sellDevice(
  params: {
    deviceId: string;
    orderId: string;
    orderItemId: string;
    customerId: string;
    createdBy: string;
    /** Cho phép ghi lùi ngày bán (VD: ghi nhận bán nhanh cho việc đã bán trước đó). Mặc định là hiện tại. */
    soldAt?: string;
  },
  db: D1Database = getDb()
) {
  const cas = await db
    .prepare(
      `UPDATE devices SET status = 'SOLD', order_id = ?, order_item_id = ?, customer_id = ?,
         sold_at = COALESCE(?, datetime('now')), updated_at = datetime('now')
       WHERE id = ? AND status = 'IN_STOCK'`
    )
    .bind(params.orderId, params.orderItemId, params.customerId, params.soldAt ?? null, params.deviceId)
    .run();
  if (!cas.meta.changes) {
    throw new ConflictError("Thiết bị này không còn trong kho (có thể đã được bán bởi đơn khác)");
  }
  await recordDeviceHistory(db, {
    deviceId: params.deviceId,
    eventType: "SELL",
    fromStatus: "IN_STOCK",
    toStatus: "SOLD",
    orderId: params.orderId,
    customerId: params.customerId,
    createdBy: params.createdBy,
  });
}

/**
 * "Ghi nhận bán nhanh" — xử lý tình huống bán máy trực tiếp ngoài đời rồi
 * quên tạo đơn trong hệ thống: tạo 1 đơn hàng tối giản (1 dòng, đã CONFIRMED)
 * và gán thiết bị cho khách ngay, không cần đi qua form tạo đơn đầy đủ.
 * Đơn này vẫn là 1 order/order_item thật nên lên đúng Công nợ, lịch sử khách
 * hàng và có thể dùng để tạo Biên bản lắp đặt như đơn bình thường.
 */
export async function recordQuickSale(
  params: {
    deviceId: string;
    customerId: string;
    /** Ngày bán thực tế nếu ghi nhận muộn (định dạng "YYYY-MM-DD HH:MM:SS"). Mặc định là hiện tại. */
    soldAt?: string;
    note?: string;
    createdBy: string;
  },
  db: D1Database = getDb()
): Promise<{ orderId: string; orderCode: string }> {
  const device = await db.prepare(`SELECT * FROM devices WHERE id = ?`).bind(params.deviceId).first<DeviceRow>();
  if (!device) throw new NotFoundError("Không tìm thấy thiết bị");
  if (device.status !== "IN_STOCK") {
    throw new ConflictError("Thiết bị này không còn trong kho, không thể ghi nhận bán");
  }

  const customer = await db
    .prepare(`SELECT * FROM customers WHERE id = ? AND is_deleted = 0`)
    .bind(params.customerId)
    .first<CustomerRow>();
  if (!customer) throw new NotFoundError("Không tìm thấy khách hàng");

  const variant = await db
    .prepare(
      `SELECT pv.*, p.name as product_name FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE pv.id = ?`
    )
    .bind(device.product_variant_id)
    .first<ProductVariantRow & { product_name: string }>();
  if (!variant) throw new NotFoundError("Không tìm thấy SKU của thiết bị");

  const customPrice = await db
    .prepare(`SELECT unit_price FROM customer_prices WHERE customer_id = ? AND product_variant_id = ?`)
    .bind(customer.id, variant.id)
    .first<{ unit_price: number }>();
  const unitPrice = customPrice?.unit_price ?? variant.unit_price;

  const orderId = newId();
  const orderItemId = newId();
  const orderCode = await nextOrderCode(db);
  const soldAt = params.soldAt ?? nowIso();
  const note = params.note?.trim() || "Ghi nhận bán nhanh từ trang Thiết bị (bán trực tiếp, bổ sung vào hệ thống)";

  await db
    .prepare(
      `INSERT INTO orders
         (id, order_code, customer_id, customer_phone_snapshot, customer_address_snapshot, note, status, total_amount, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?, ?, ?)`
    )
    .bind(orderId, orderCode, customer.id, customer.phone, customer.address, note, unitPrice, params.createdBy, soldAt, soldAt)
    .run();

  await db
    .prepare(
      `INSERT INTO order_items (id, order_id, product_variant_id, sku, product_name, quantity, unit_price, line_total, device_id)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`
    )
    .bind(orderItemId, orderId, variant.id, variant.sku, variant.product_name, unitPrice, unitPrice, device.id)
    .run();

  await sellDevice(
    { deviceId: device.id, orderId, orderItemId, customerId: customer.id, createdBy: params.createdBy, soldAt },
    db
  );

  return { orderId, orderCode };
}

/** Hủy đơn trước khi giao — trả thiết bị về kho. */
export async function releaseDevice(
  params: { deviceId: string; createdBy: string },
  db: D1Database = getDb()
) {
  const device = await db.prepare(`SELECT * FROM devices WHERE id = ?`).bind(params.deviceId).first<DeviceRow>();
  if (!device) return;
  await db
    .prepare(
      `UPDATE devices SET status = 'IN_STOCK', order_id = NULL, order_item_id = NULL, customer_id = NULL,
         sold_at = NULL, updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(params.deviceId)
    .run();
  await recordDeviceHistory(db, {
    deviceId: params.deviceId,
    eventType: "RELEASE",
    fromStatus: device.status,
    toStatus: "IN_STOCK",
    note: "Đơn hàng bị hủy, trả thiết bị về kho",
    createdBy: params.createdBy,
  });
}

export async function changeDeviceStatus(
  params: { deviceId: string; toStatus: DeviceStatus; note?: string; createdBy: string },
  db: D1Database = getDb()
) {
  const device = await db.prepare(`SELECT * FROM devices WHERE id = ?`).bind(params.deviceId).first<DeviceRow>();
  if (!device) throw new NotFoundError("Không tìm thấy thiết bị");

  await db
    .prepare(`UPDATE devices SET status = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(params.toStatus, params.deviceId)
    .run();

  await recordDeviceHistory(db, {
    deviceId: params.deviceId,
    eventType: "STATUS_CHANGE",
    fromStatus: device.status,
    toStatus: params.toStatus,
    note: params.note,
    createdBy: params.createdBy,
  });
}

export { recordDeviceHistory };
