import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { HandoverProtocolRow } from "@/types/db";

const updateSchema = z.object({
  contactName: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
  installAddress: z.string().trim().optional(),
  note: z.string().trim().optional(),
  technicianId: z.string().trim().optional().nullable(),
  installedAt: z.string().trim().optional().nullable(),
  deviceCondition: z.string().trim().optional().nullable(),
  exceptionNote: z.string().trim().optional().nullable(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/protocols/[id]">) {
  try {
    const session = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const json = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) throw new ValidationError("Dữ liệu không hợp lệ");

    const db = getDb();
    const protocol = await db
      .prepare(`SELECT * FROM handover_protocols WHERE id = ?`)
      .bind(id)
      .first<HandoverProtocolRow>();
    if (!protocol) throw new NotFoundError("Không tìm thấy biên bản");

    const d = parsed.data;
    const next = {
      contact_name: d.contactName ?? protocol.contact_name,
      contact_phone: d.contactPhone ?? protocol.contact_phone,
      install_address: d.installAddress ?? protocol.install_address,
      note: d.note ?? protocol.note,
      technician_id: d.technicianId !== undefined ? d.technicianId : protocol.technician_id,
      installed_at: d.installedAt !== undefined ? d.installedAt : protocol.installed_at,
      device_condition: d.deviceCondition !== undefined ? d.deviceCondition : protocol.device_condition,
      exception_note: d.exceptionNote !== undefined ? d.exceptionNote : protocol.exception_note,
    };

    await db
      .prepare(
        `UPDATE handover_protocols SET contact_name = ?, contact_phone = ?, install_address = ?, note = ?,
           technician_id = ?, installed_at = ?, device_condition = ?, exception_note = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(
        next.contact_name,
        next.contact_phone,
        next.install_address,
        next.note,
        next.technician_id,
        next.installed_at,
        next.device_condition,
        next.exception_note,
        id
      )
      .run();

    await writeAuditLog({ userId: session.user.id, action: "UPDATE_PROTOCOL", entity: "handover_protocol", entityId: id });

    const updated = await db.prepare(`SELECT * FROM handover_protocols WHERE id = ?`).bind(id).first();
    return NextResponse.json({ protocol: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
