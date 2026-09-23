import { Badge } from "@/components/ui/badge";
import type { QuoteStatus } from "@/types/db";

const STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: "Nháp",
  SENT: "Đã gửi",
  VIEWED: "Khách đã xem",
  ACCEPTED: "Đã chấp nhận",
  REJECTED: "Đã từ chối",
  EXPIRED: "Hết hạn",
  CONVERTED: "Đã tạo đơn",
};

const STATUS_VARIANT: Record<QuoteStatus, "secondary" | "info" | "warning" | "success" | "danger"> = {
  DRAFT: "secondary",
  SENT: "info",
  VIEWED: "warning",
  ACCEPTED: "success",
  REJECTED: "danger",
  EXPIRED: "secondary",
  CONVERTED: "success",
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export { STATUS_LABEL as QUOTE_STATUS_LABEL };
