import { getDb } from "@/lib/db/client";
import { newId, nextProtocolCode } from "@/lib/db/id";
import { ConflictError, NotFoundError } from "@/lib/api/errors";
import type { CustomerRow, OrderRow } from "@/types/db";

/** Biên bản lắp đặt — 13 mục checklist kỹ thuật (spec cố định). */
export function buildInstallChecklistLabels(): string[] {
  return [
    "Kiểm tra vị trí lắp đặt",
    "Kiểm tra nguồn điện",
    "Kiểm tra nguồn nước",
    "Lắp đặt thiết bị",
    "Kiểm tra áp suất",
    "Kiểm tra nhiệt độ",
    "Kiểm tra rò rỉ",
    "Kiểm tra hệ thống cấp nước",
    "Kiểm tra hệ thống xả",
    "Chạy thử máy",
    "Kiểm tra máy xay",
    "Kiểm tra phụ kiện",
    "Vệ sinh thiết bị sau lắp đặt",
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
  device_id: string;
  product_name: string;
  model: string | null;
  serial_number: string;
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

  const { results: deviceLines } = await db
    .prepare(
      `SELECT oi.device_id, oi.product_name, pv.model, d.serial_number, oi.quantity
       FROM order_items oi
       JOIN devices d ON d.id = oi.device_id
       JOIN product_variants pv ON pv.id = oi.product_variant_id
       WHERE oi.order_id = ? AND oi.device_id IS NOT NULL`
    )
    .bind(params.orderId)
    .all<DeviceLineRow>();
  if (deviceLines.length === 0) {
    throw new ConflictError("Đơn hàng này chưa có thiết bị (Serial) nào để tạo biên bản");
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

  await db
    .prepare(
      `INSERT INTO handover_protocols
         (id, protocol_code, order_id, customer_id, contact_name, contact_phone, install_address, technician_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    ...installLabels.map((label, idx) =>
      db
        .prepare(
          `INSERT INTO handover_protocol_checklist (id, protocol_id, category, label, sort_order)
           VALUES (?, ?, 'INSTALL', ?, ?)`
        )
        .bind(newId(), protocolId, label, idx)
    ),
    ...guideLabels.map((label, idx) =>
      db
        .prepare(
          `INSERT INTO handover_protocol_checklist (id, protocol_id, category, label, sort_order)
           VALUES (?, ?, 'GUIDE', ?, ?)`
        )
        .bind(newId(), protocolId, label, idx)
    ),
  ]);

  return { id: protocolId, created: true };
}
