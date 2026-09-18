import { getDb } from "@/lib/db/client";
import { newId, nextProtocolCode } from "@/lib/db/id";
import { ConflictError, NotFoundError } from "@/lib/api/errors";
import { INSTALLABLE_EQUIPMENT_TYPES } from "@/lib/constants";
import { recordDeviceHistory } from "@/lib/services/devices";
import type {
  CustomerRow,
  DeviceRow,
  HandoverProtocolDeviceRow,
  OrderRow,
  ProductVariantRow,
} from "@/types/db";

/**
 * Set warranty_start_date/end_date + status IN_USE cho mọi thiết bị có
 * Serial trong biên bản (bỏ qua thiết bị đã kích hoạt trước đó — idempotent).
 * Dùng chung cho cả nút "Kích hoạt bảo hành" thủ công lẫn tự động kích hoạt
 * ngay khi tạo biên bản.
 */
export async function activateProtocolDeviceWarranties(
  db: D1Database,
  params: { protocolId: string; protocolCode: string; orderId: string; customerId: string; activatedBy: string }
): Promise<void> {
  const { results: protocolDevices } = await db
    .prepare(`SELECT * FROM handover_protocol_devices WHERE protocol_id = ? AND device_id IS NOT NULL`)
    .bind(params.protocolId)
    .all<HandoverProtocolDeviceRow>();

  for (const pd of protocolDevices) {
    const device = await db.prepare(`SELECT * FROM devices WHERE id = ?`).bind(pd.device_id).first<DeviceRow>();
    if (!device || device.warranty_start_date) continue; // idempotent — never overwrite an existing warranty window

    const variant = await db
      .prepare(`SELECT * FROM product_variants WHERE id = ?`)
      .bind(device.product_variant_id)
      .first<ProductVariantRow>();
    const warrantyMonths =
      variant?.warranty_months && Number.isInteger(variant.warranty_months) ? variant.warranty_months : null;
    const warrantyEndExpr = warrantyMonths ? `datetime('now', '+${warrantyMonths} months')` : "NULL";

    await db
      .prepare(
        `UPDATE devices SET status = 'IN_USE', customer_id = ?, handed_over_at = datetime('now'),
           warranty_start_date = datetime('now'), warranty_end_date = ${warrantyEndExpr}, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(params.customerId, device.id)
      .run();

    await recordDeviceHistory(db, {
      deviceId: device.id,
      eventType: "STATUS_CHANGE",
      fromStatus: device.status,
      toStatus: "IN_USE",
      orderId: params.orderId,
      customerId: params.customerId,
      note: `Kích hoạt bảo hành qua biên bản ${params.protocolCode}`,
      createdBy: params.activatedBy,
    });
  }
}

/** Biên bản lắp đặt — 4 mục checklist rút gọn (spec cố định). */
export function buildInstallChecklistLabels(): string[] {
  return [
    "Kiểm tra máy & phụ kiện đi kèm",
    "Kiểm tra điện – nước – đường xả",
    "Lắp đặt & cân chỉnh máy",
    "Test máy & pha thử Espresso",
  ];
}

/** Hướng dẫn khách hàng — 8 mục checklist cố định. */
export function buildGuideChecklistLabels(): string[] {
  return [
    "Hướng dẫn vận hành máy",
    "Hướng dẫn pha cà phê",
    "Hướng dẫn vệ sinh hằng ngày",
    "Hướng dẫn vệ sinh định kỳ",
    "Hướng dẫn backflush",
    "Hướng dẫn vệ sinh máy xay",
    "Hướng dẫn xử lý các lỗi cơ bản",
    "Hướng dẫn liên hệ bảo hành",
  ];
}

interface DeviceLineRow {
  device_id: string | null;
  product_name: string;
  model: string | null;
  serial_number: string | null;
  quantity: number;
}

interface AccessoryLineRow {
  name: string;
  quantity: number;
}

/**
 * Tạo biên bản trực tiếp từ đơn hàng — tự lấy toàn bộ thiết bị (mọi dòng
 * order_items có device_id) và phụ kiện (dòng order_items thuộc sản phẩm
 * loại ACCESSORY) trong đơn, không yêu cầu nhập lại. Một đơn chỉ có 1 biên
 * bản (idempotent) — gọi lại trả về biên bản đã có, không tạo trùng.
 */
export async function createProtocolFromOrder(
  params: { orderId: string; createdBy: string },
  db: D1Database = getDb()
): Promise<{ id: string; created: boolean }> {
  const existing = await db
    .prepare(`SELECT id FROM handover_protocols WHERE order_id = ?`)
    .bind(params.orderId)
    .first<{ id: string }>();
  if (existing) return { id: existing.id, created: false };

  const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(params.orderId).first<OrderRow>();
  if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");
  if (order.status === "CANCELLED") {
    throw new ConflictError("Không thể tạo biên bản cho đơn hàng đã hủy");
  }
  const customer = await db
    .prepare(`SELECT * FROM customers WHERE id = ?`)
    .bind(order.customer_id)
    .first<CustomerRow>();
  if (!customer) throw new NotFoundError("Không tìm thấy khách hàng");

  // Lấy mọi dòng máy/thiết bị cần lắp đặt trong đơn — có Serial (device_id)
  // thì kèm luôn số Serial, còn SKU máy/thiết bị KHÔNG quản lý Serial vẫn
  // được liệt kê (chỉ thiếu số Serial) để biên bản vẫn lập được bình thường.
  const placeholders = INSTALLABLE_EQUIPMENT_TYPES.map(() => "?").join(",");
  const { results: deviceLines } = await db
    .prepare(
      `SELECT oi.device_id, oi.product_name, pv.model, d.serial_number, oi.quantity
       FROM order_items oi
       JOIN product_variants pv ON pv.id = oi.product_variant_id
       JOIN products p ON p.id = pv.product_id
       LEFT JOIN devices d ON d.id = oi.device_id
       WHERE oi.order_id = ? AND (oi.device_id IS NOT NULL OR p.product_type IN (${placeholders}))`
    )
    .bind(params.orderId, ...INSTALLABLE_EQUIPMENT_TYPES)
    .all<DeviceLineRow>();
  if (deviceLines.length === 0) {
    throw new ConflictError("Đơn hàng này chưa có máy/thiết bị nào để tạo biên bản");
  }

  const { results: accessoryLines } = await db
    .prepare(
      `SELECT oi.product_name as name, oi.quantity
       FROM order_items oi
       JOIN product_variants pv ON pv.id = oi.product_variant_id
       JOIN products p ON p.id = pv.product_id
       WHERE oi.order_id = ? AND p.product_type = 'ACCESSORY'`
    )
    .bind(params.orderId)
    .all<AccessoryLineRow>();

  const technician = await db
    .prepare(
      `SELECT technician_id FROM installations WHERE order_id = ? AND technician_id IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`
    )
    .bind(params.orderId)
    .first<{ technician_id: string }>();

  const protocolId = newId();
  const protocolCode = await nextProtocolCode(db);

  // Bỏ hẳn các bước Bắt đầu lắp đặt/Hoàn tất lắp đặt/chờ ký — biên bản tạo
  // ra là coi như đã lắp đặt, bàn giao và kích hoạt bảo hành luôn, chỉ để
  // in ra dùng làm phiếu giấy tại hiện trường.
  await db
    .prepare(
      `INSERT INTO handover_protocols
         (id, protocol_code, order_id, customer_id, contact_name, contact_phone, install_address, technician_id,
          created_by, status, installed_at, handed_over_at, warranty_activated_at, warranty_activated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'WARRANTY_ACTIVATED', datetime('now'), datetime('now'), datetime('now'), ?)`
    )
    .bind(
      protocolId,
      protocolCode,
      params.orderId,
      order.customer_id,
      customer.name,
      order.customer_phone_snapshot,
      order.customer_address_snapshot,
      technician?.technician_id ?? null,
      params.createdBy,
      params.createdBy
    )
    .run();

  const installLabels = buildInstallChecklistLabels();
  const guideLabels = buildGuideChecklistLabels();

  await db.batch([
    ...deviceLines.map((d, idx) =>
      db
        .prepare(
          `INSERT INTO handover_protocol_devices
             (id, protocol_id, device_id, product_name, model, serial_number, quantity, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(newId(), protocolId, d.device_id, d.product_name, d.model, d.serial_number, d.quantity, idx)
    ),
    ...accessoryLines.map((a, idx) =>
      db
        .prepare(
          `INSERT INTO handover_protocol_accessories (id, protocol_id, name, quantity, sort_order)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(newId(), protocolId, a.name, a.quantity, idx)
    ),
    // Tích sẵn hết — biên bản dùng như phiếu in mang đi lắp đặt/xác nhận
    // nhanh, không bắt buộc tick tay từng mục qua app mới đủ điều kiện
    // "Hoàn tất lắp đặt".
    ...installLabels.map((label, idx) =>
      db
        .prepare(
          `INSERT INTO handover_protocol_checklist (id, protocol_id, category, label, sort_order, is_checked, checked_at)
           VALUES (?, ?, 'INSTALL', ?, ?, 1, datetime('now'))`
        )
        .bind(newId(), protocolId, label, idx)
    ),
    ...guideLabels.map((label, idx) =>
      db
        .prepare(
          `INSERT INTO handover_protocol_checklist (id, protocol_id, category, label, sort_order, is_checked, checked_at)
           VALUES (?, ?, 'GUIDE', ?, ?, 1, datetime('now'))`
        )
        .bind(newId(), protocolId, label, idx)
    ),
  ]);

  await activateProtocolDeviceWarranties(db, {
    protocolId,
    protocolCode,
    orderId: params.orderId,
    customerId: order.customer_id,
    activatedBy: params.createdBy,
  });

  return { id: protocolId, created: true };
}
