import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { sendNotification } from "@/lib/services/notifications";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { InstallationRow, UserRow } from "@/types/db";

const bodySchema = z.object({
  technicianId: z.string().min(1),
  scheduledAt: z.string().trim().min(1),
});

export async function POST(req: NextRequest, ctx: RouteContext<"/api/installations/[id]/schedule">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }

    const db = getDb();
    const installation = await db
      .prepare(`SELECT * FROM installations WHERE id = ?`)
      .bind(id)
      .first<InstallationRow>();
    if (!installation) throw new NotFoundError("Không tìm thấy job lắp đặt");
    if (installation.status === "COMPLETED" || installation.status === "HANDED_OVER" || installation.status === "CANCELLED") {
      throw new ValidationError("Không thể lên lịch cho job đã kết thúc");
    }

    const technician = await db
      .prepare(`SELECT * FROM users WHERE id = ? AND status = 'ACTIVE'`)
      .bind(parsed.data.technicianId)
      .first<UserRow>();
    if (!technician) throw new NotFoundError("Không tìm thấy nhân viên/kỹ thuật");

    const scheduledAt = new Date(parsed.data.scheduledAt).toISOString();
    const nextStatus = installation.status === "PENDING" ? "SCHEDULED" : installation.status;

    await db
      .prepare(
        `UPDATE installations SET technician_id = ?, scheduled_at = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(parsed.data.technicianId, scheduledAt, nextStatus, id)
      .run();

    await sendNotification({
      userId: technician.id,
      title: "🔧 Có lịch lắp đặt mới",
      body: `Thiết bị: ${installation.equipment} — Ngày lắp: ${new Date(scheduledAt).toLocaleString("vi-VN")}`,
      type: "INSTALLATION_ASSIGNED",
      referenceType: "installation",
      referenceId: id,
      channels: ["IN_APP", "LARK"],
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "SCHEDULE_INSTALLATION",
      entity: "installation",
      entityId: id,
      metadata: { technicianId: parsed.data.technicianId, scheduledAt },
    });

    const updated = await db.prepare(`SELECT * FROM installations WHERE id = ?`).bind(id).first();
    return NextResponse.json({ installation: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
