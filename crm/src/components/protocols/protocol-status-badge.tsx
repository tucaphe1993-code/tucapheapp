import { Badge } from "@/components/ui/badge";
import type { ProtocolStatus } from "@/types/db";

export const PROTOCOL_STATUS_LABEL: Record<ProtocolStatus, string> = {
  PENDING_INSTALL: "Chờ lắp đặt",
  INSTALLING: "Đang lắp đặt",
  PENDING_CONFIRMATION: "Chờ xác nhận",
  HANDED_OVER: "Đã bàn giao",
  WARRANTY_ACTIVATED: "Đã kích hoạt bảo hành",
  COMPLETED: "Hoàn tất",
};

const PROTOCOL_STATUS_VARIANT: Record<ProtocolStatus, "danger" | "warning" | "success" | "secondary" | "info" | "default"> = {
  PENDING_INSTALL: "secondary",
  INSTALLING: "warning",
  PENDING_CONFIRMATION: "info",
  HANDED_OVER: "success",
  WARRANTY_ACTIVATED: "default",
  COMPLETED: "success",
};

export function ProtocolStatusBadge({ status }: { status: ProtocolStatus }) {
  return <Badge variant={PROTOCOL_STATUS_VARIANT[status]}>{PROTOCOL_STATUS_LABEL[status]}</Badge>;
}
