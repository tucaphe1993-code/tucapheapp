import { Badge } from "@/components/ui/badge";
import type { TaskStatus, TaskPriority } from "@/types/db";

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "Cần làm",
  IN_PROGRESS: "Đang làm",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};
const STATUS_VARIANT: Record<TaskStatus, "danger" | "warning" | "success" | "secondary"> = {
  TODO: "danger",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "secondary",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: "Thấp",
  NORMAL: "Bình thường",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
};
const PRIORITY_VARIANT: Record<TaskPriority, "secondary" | "info" | "warning" | "danger"> = {
  LOW: "secondary",
  NORMAL: "info",
  HIGH: "warning",
  URGENT: "danger",
};

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge variant={PRIORITY_VARIANT[priority]}>{PRIORITY_LABEL[priority]}</Badge>;
}
