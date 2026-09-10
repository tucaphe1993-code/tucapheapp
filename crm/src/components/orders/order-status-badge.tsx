import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/types/db";

const STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: "Nháp",
  CONFIRMED: "Đã xác nhận",
  PACKING: "Đang đóng gói",
  PACKED: "Đã đóng gói",
  SHIPPED: "Đã giao",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

const STATUS_VARIANT: Record<OrderStatus, "secondary" | "info" | "warning" | "success" | "danger"> = {
  DRAFT: "secondary",
  CONFIRMED: "info",
  PACKING: "warning",
  PACKED: "warning",
  SHIPPED: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export { STATUS_LABEL as ORDER_STATUS_LABEL };
