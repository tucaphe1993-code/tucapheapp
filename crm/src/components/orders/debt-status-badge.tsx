import { Badge } from "@/components/ui/badge";
import { DEBT_STATUS_LABEL } from "@/lib/services/debts";
import type { DebtStatus } from "@/types/db";

const DEBT_STATUS_VARIANT: Record<DebtStatus, "danger" | "warning" | "success" | "secondary"> = {
  UNPAID: "secondary",
  PARTIAL: "warning",
  PAID: "success",
  OVERDUE: "danger",
};

export function DebtStatusBadge({ status }: { status: DebtStatus }) {
  return <Badge variant={DEBT_STATUS_VARIANT[status]}>{DEBT_STATUS_LABEL[status]}</Badge>;
}
