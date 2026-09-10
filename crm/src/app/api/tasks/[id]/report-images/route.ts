import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { requireRole } from "@/lib/auth/session";
import { uploadReportImage } from "@/lib/services/r2";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/api/errors";
import type { ReportRow, TaskRow } from "@/types/db";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest, ctx: RouteContext<"/api/tasks/[id]/report-images">) {
  try {
    const session = await requireRole("ADMIN", "EMPLOYEE");
    const { id } = await ctx.params;

    const db = getDb();
    const task = await db.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(id).first<TaskRow>();
    if (!task) throw new NotFoundError("Không tìm thấy công việc");
    if (session.user.role === "EMPLOYEE" && task.assigned_to !== session.user.id) {
      throw new ForbiddenError();
    }
    if (task.status !== "IN_PROGRESS") {
      throw new ValidationError("Chỉ tải ảnh khi công việc đang thực hiện");
    }

    const report = await db
      .prepare(`SELECT * FROM reports WHERE task_id = ?`)
      .bind(id)
      .first<ReportRow>();
    if (!report) throw new ValidationError("Không tìm thấy báo cáo cho công việc này");

    const form = await req.formData().catch(() => null);
    const file = form?.get("image");
    if (!file || !(file instanceof File)) {
      throw new ValidationError("Thiếu file ảnh");
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      throw new ValidationError("Định dạng ảnh không hợp lệ (chỉ nhận JPEG/PNG/WebP)");
    }
    if (!/\.(jpe?g|png|webp)$/i.test(file.name || "")) {
      throw new ValidationError("Tên file ảnh không hợp lệ");
    }

    const bytes = await file.arrayBuffer();
    const { key, url } = await uploadReportImage({
      orderId: task.order_id,
      taskId: task.id,
      bytes,
      contentType: file.type,
    });

    const imageId = newId();
    await db
      .prepare(
        `INSERT INTO report_images (id, report_id, order_id, task_id, r2_key, image_url, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(imageId, report.id, task.order_id, task.id, key, url, session.user.id)
      .run();

    await writeAuditLog({
      userId: session.user.id,
      action: "UPLOAD_REPORT_IMAGE",
      entity: "report_image",
      entityId: imageId,
      metadata: { taskId: id },
    });

    const image = await db.prepare(`SELECT * FROM report_images WHERE id = ?`).bind(imageId).first();
    return NextResponse.json({ image }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/tasks/[id]/report-images">) {
  try {
    const session = await requireRole("ADMIN", "EMPLOYEE");
    const { id } = await ctx.params;
    const db = getDb();

    const task = await db.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(id).first<TaskRow>();
    if (!task) throw new NotFoundError("Không tìm thấy công việc");
    if (session.user.role === "EMPLOYEE" && task.assigned_to !== session.user.id) {
      throw new ForbiddenError();
    }

    const { results } = await db
      .prepare(`SELECT * FROM report_images WHERE task_id = ? ORDER BY created_at ASC`)
      .bind(id)
      .all();
    return NextResponse.json({ images: results });
  } catch (err) {
    return handleApiError(err);
  }
}
