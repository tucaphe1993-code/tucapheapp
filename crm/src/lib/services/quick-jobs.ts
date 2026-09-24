// TÚ QUICK — "Công việc" hẹn nhanh (bảng quick_jobs, migration 026).
import { z } from "zod";
import { NotFoundError } from "@/lib/api/errors";

/** Field dùng chung cho tạo mới (POST) và sửa (PATCH). */
export const quickJobFields = {
  customerId: z.string().min(1).nullable(),
  title: z.string().trim().min(1, "Nhập việc cần làm").max(200),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày hẹn không hợp lệ")
    .nullable(),
  note: z.string().trim().max(1000).nullable(),
};

export async function assertCustomerExists(db: D1Database, customerId: string | null | undefined) {
  if (!customerId) return;
  const c = await db.prepare(`SELECT id FROM customers WHERE id = ? AND is_deleted = 0`).bind(customerId).first();
  if (!c) throw new NotFoundError("Không tìm thấy khách hàng");
}
