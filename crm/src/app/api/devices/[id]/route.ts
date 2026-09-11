import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { recordDeviceHistory } from "@/lib/services/devices";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { DeviceRow } from "@/types/db";

const updateSchema = z.object({
  warrantyStartDate: z.string().trim().optional().nullable(),
  warrantyEndDate: z.string().trim().optional().nullable(),
  supplier: z.string().trim().optional().nullable(),
  note: z.string().trim().optional().nullable(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/devices/[id]">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) throw new ValidationError("Dữ liệu không hợp lệ");

    const db = getDb();
    const device = await db.prepare(`SELECT * FROM devices WHERE id = ?`).bind(id).first<DeviceRow>();
    if (!device) throw new NotFoundError("Không tìm thấy thiết bị");

    const next = {
      warranty_start_date:
        parsed.data.warrantyStartDate !== undefined ? parsed.data.warrantyStartDate : device.warranty_start_date,
      warranty_end_date:
        parsed.data.warrantyEndDate !== undefined ? parsed.data.warrantyEndDate : device.warranty_end_date,
      supplier: parsed.data.supplier !== undefined ? parsed.data.supplier : device.supplier,
      note: parsed.data.note !== undefined ? parsed.data.note : device.note,
    };

    await db
      .prepare(
        `UPDATE devices SET warranty_start_date = ?, warranty_end_date = ?, supplier = ?, note = ?,
           updated_at = datetime('now') WHERE id = ?`
      )
      .bind(next.warranty_start_date, next.warranty_end_date, next.supplier, next.note, id)
      .run();

    await recordDeviceHistory(db, {
      deviceId: id,
      eventType: "UPDATE",
      note: "Cập nhật thông tin thiết bị",
      createdBy: session.user.id,
    });

    await writeAuditLog({ userId: session.user.id, action: "UPDATE_DEVICE", entity: "device", entityId: id });

    const updated = await db.prepare(`SELECT * FROM devices WHERE id = ?`).bind(id).first();
    return NextResponse.json({ device: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
