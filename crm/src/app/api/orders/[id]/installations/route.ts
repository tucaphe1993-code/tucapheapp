import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { sendNotification } from "@/lib/services/notifications";
import { createChecklistForInstallation } from "@/lib/services/installations";
import { changeDeviceStatus } from "@/lib/services/devices";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { DeviceRow, OrderRow, UserRow } from "@/types/db";

const createSchema = z.object({
  equipment: z.string().trim().min(1, "Vui lòng nhập tên thiết bị"),
  serialNumber: z.string().trim().optional(),
  deviceId: z.string().trim().optional(),
  location: z.string().trim().optional(),
  scheduledAt: z.string().trim().optional(),
  technicianId: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

export async function POST(req: NextRequest, ctx: RouteContext<"/api/orders/[id]/installations">) {
  try {
    const session = await requireRole("ADMIN");
    const { id: orderId } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }
    const { equipment, location, scheduledAt, technicianId, note } = parsed.data;
    let { serialNumber } = parsed.data;

    const db = getDb();
    const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first<OrderRow>();
    if (!order) throw new NotFoundError("Không tìm thấy đơn hàng");
    if (order.status === "CANCELLED") {
      throw new ValidationError("Không thể tạo lắp đặt cho đơn đã hủy");
    }

    let device: DeviceRow | null = null;
    if (parsed.data.deviceId) {
      device = await db
        .prepare(`SELECT * FROM devices WHERE id = ? AND order_id = ?`)
        .bind(parsed.data.deviceId, orderId)
        .first<DeviceRow>();
      if (!device) throw new NotFoundError("Không tìm thấy thiết bị đã bán trong đơn này");
      serialNumber = device.serial_number;
    }

    let technician: UserRow | null = null;
    if (technicianId) {
      technician = await db
        .prepare(`SELECT * FROM users WHERE id = ? AND status = 'ACTIVE'`)
        .bind(technicianId)
        .first<UserRow>();
      if (!technician) throw new NotFoundError("Không tìm thấy nhân viên/kỹ thuật");
    }

    const installationId = newId();
    const status = technician && scheduledAt ? "SCHEDULED" : "PENDING";

    await db
      .prepare(
        `INSERT INTO installations
           (id, order_id, customer_id, equipment, serial_number, device_id, location, scheduled_at, technician_id, assigned_by, note, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        installationId,
        orderId,
        order.customer_id,
        equipment,
        serialNumber || null,
        device?.id ?? null,
        location || order.customer_address_snapshot,
        scheduledAt ? new Date(scheduledAt).toISOString() : null,
        technicianId || null,
        session.user.id,
        note || null,
        status
      )
      .run();

    await createChecklistForInstallation(installationId);

    if (device) {
      await changeDeviceStatus(
        { deviceId: device.id, toStatus: "AWAITING_INSTALL", note: "Đã tạo job lắp đặt", createdBy: session.user.id },
        db
      );
    }

    if (technician) {
      await sendNotification({
        userId: technician.id,
        title: "🔧 Có lịch lắp đặt mới",
        body: `Thiết bị: ${equipment} — Địa điểm: ${location || order.customer_address_snapshot || "—"}${
          scheduledAt ? ` — Ngày lắp: ${new Date(scheduledAt).toLocaleString("vi-VN")}` : ""
        }`,
        type: "INSTALLATION_ASSIGNED",
        referenceType: "installation",
        referenceId: installationId,
        channels: ["IN_APP", "LARK"],
      });
    }

    await writeAuditLog({
      userId: session.user.id,
      action: "CREATE_INSTALLATION",
      entity: "installation",
      entityId: installationId,
      metadata: { orderId, equipment, technicianId },
    });

    const installation = await db
      .prepare(`SELECT * FROM installations WHERE id = ?`)
      .bind(installationId)
      .first();
    return NextResponse.json({ installation }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
