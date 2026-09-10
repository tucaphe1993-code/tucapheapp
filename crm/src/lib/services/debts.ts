import type { DebtStatus } from "@/types/db";

/**
 * Debt status is always DERIVED from total_amount - SUM(payments), never
 * stored — so it can never drift out of sync with the payment history.
 */
export function computeDebtStatus(params: {
  totalAmount: number;
  paidAmount: number;
  dueDate: string | null;
  now?: Date;
}): DebtStatus {
  const remaining = params.totalAmount - params.paidAmount;
  if (remaining <= 0) return "PAID";
  const now = params.now ?? new Date();
  if (params.dueDate && new Date(params.dueDate) < now) return "OVERDUE";
  if (params.paidAmount > 0) return "PARTIAL";
  return "UNPAID";
}

export const DEBT_STATUS_LABEL: Record<DebtStatus, string> = {
  UNPAID: "Chưa thanh toán",
  PARTIAL: "Thanh toán một phần",
  PAID: "Đã thanh toán",
  OVERDUE: "Quá hạn",
};
