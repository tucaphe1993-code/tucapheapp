import { Badge } from "@/components/ui/badge";
import { DEVICE_STATUS_LABEL } from "@/lib/services/devices";
import type { DeviceStatus } from "@/types/db";

const DEVICE_STATUS_VARIANT: Record<
  DeviceStatus,
  "danger" | "warning" | "success" | "secondary" | "info" | "default"
> = {
  IN_STOCK: "success",
  SOLD: "info",
  AWAITING_INSTALL: "secondary",
  INSTALLING: "warning",
  IN_USE: "default",
  UNDER_WARRANTY: "info",
  IN_REPAIR: "warning",
  RECALLED: "danger",
  RETIRED: "secondary",
};

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  return <Badge variant={DEVICE_STATUS_VARIANT[status]}>{DEVICE_STATUS_LABEL[status]}</Badge>;
}
