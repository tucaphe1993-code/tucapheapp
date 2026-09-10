import { Badge } from "@/components/ui/badge";
import type { InstallationStatus } from "@/types/db";

export const INSTALLATION_STATUS_LABEL: Record<InstallationStatus, string> = {
  PENDING: "Chờ lắp đặt",
  SCHEDULED: "Đã lên lịch",
  IN_PROGRESS: "Đang lắp",
  COMPLETED: "Hoàn thành",
  HANDED_OVER: "Đã bàn giao",
  CANCELLED: "Đã hủy",
};

const INSTALLATION_STATUS_VARIANT: Record<
  InstallationStatus,
  "danger" | "warning" | "success" | "secondary" | "info" | "default"
> = {
  PENDING: "secondary",
  SCHEDULED: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  HANDED_OVER: "default",
  CANCELLED: "danger",
};

export function InstallationStatusBadge({ status }: { status: InstallationStatus }) {
  return <Badge variant={INSTALLATION_STATUS_VARIANT[status]}>{INSTALLATION_STATUS_LABEL[status]}</Badge>;
}
