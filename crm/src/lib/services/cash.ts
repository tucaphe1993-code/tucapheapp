import { getDb } from "@/lib/db/client";
import { newId, nextCashVoucherCode } from "@/lib/db/id";
import { ValidationError } from "@/lib/api/errors";
import type { CashVoucherCategory, CashVoucherDirection } from "@/types/db";

/**
 * Sổ quỹ thống nhất: MỌI khoản thu/chi (kể cả tự động sinh từ thu tiền
 * đơn bán / trả nợ NCC) đều ghi vào đúng 1 bảng cash_vouchers — tự sinh
 * mã PT-xxxx/PC-xxxx, không cần gọi thủ công ở nhiều nơi. is_auto=1 đánh
 * dấu các dòng tự động (Phiếu thu/chi tự động trong bản ERP mẫu).
 */
export async function recordCashVoucher(
  params: {
    direction: CashVoucherDirection;
    category: CashVoucherCategory;
    customerId?: string | null;
    supplierId?: string | null;
    expenseGroup?: string | null;
    referenceType?: string | null;
    referenceId?: string | null;
    paymentMethodCode?: string | null;
    amount: number;
    description?: string | null;
    note?: string | null;
    isAuto?: boolean;
    createdBy: string | null;
    voucherDate?: string;
  },
  db: D1Database = getDb()
) {
  if (params.amount <= 0) throw new ValidationError("Số tiền phải lớn hơn 0");

  const id = newId();
  const code = await nextCashVoucherCode(params.direction, db);
  await db
    .prepare(
      `INSERT INTO cash_vouchers
         (id, voucher_code, direction, voucher_date, customer_id, supplier_id, category, expense_group,
          reference_type, reference_id, payment_method_code, amount, description, note, is_auto, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      code,
      params.direction,
      params.voucherDate ?? new Date().toISOString(),
      params.customerId ?? null,
      params.supplierId ?? null,
      params.category,
      params.expenseGroup ?? null,
      params.referenceType ?? null,
      params.referenceId ?? null,
      params.paymentMethodCode ?? null,
      params.amount,
      params.description ?? null,
      params.note ?? null,
      params.isAuto ? 1 : 0,
      params.createdBy
    )
    .run();

  return db.prepare(`SELECT * FROM cash_vouchers WHERE id = ?`).bind(id).first();
}
