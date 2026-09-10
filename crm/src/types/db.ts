export type Role = "ADMIN" | "EMPLOYEE";
export type UserStatus = "ACTIVE" | "DISABLED";

export type ProductForm = "HAT" | "BOT";
export type ProductPackaging = "TUI_XANH" | "TUI_ZIP";

export type OrderStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "PACKING"
  | "PACKED"
  | "SHIPPED"
  | "COMPLETED"
  | "CANCELLED";

export type TaskPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type DebtStatus = "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE";

export type InstallationStatus =
  | "PENDING"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "HANDED_OVER"
  | "CANCELLED";

export type InventoryTxType = "RECEIVE" | "ISSUE" | "ADJUSTMENT";

export interface UserRow {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  password_hash: string;
  password_salt: string;
  role: Role;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export type SafeUser = Omit<UserRow, "password_hash" | "password_salt">;

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
}

export interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  province: string | null;
  note: string | null;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

export interface ProductRow {
  id: string;
  name: string;
  slug: string;
  code: string;
  description: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ProductVariantRow {
  id: string;
  product_id: string;
  form: ProductForm;
  packaging: ProductPackaging;
  weight_grams: number;
  sku: string;
  unit_price: number;
  cost_price: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerPriceRow {
  id: string;
  customer_id: string;
  product_variant_id: string;
  unit_price: number;
  created_at: string;
  updated_at: string;
}

export interface OrderRow {
  id: string;
  order_code: string;
  customer_id: string;
  customer_phone_snapshot: string | null;
  customer_address_snapshot: string | null;
  delivery_date: string | null;
  delivery_method: string | null;
  payment_due_date: string | null;
  note: string | null;
  status: OrderStatus;
  total_amount: number;
  created_by: string;
  inventory_issued_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_variant_id: string;
  sku: string;
  product_name: string;
  form: ProductForm;
  packaging: ProductPackaging;
  weight_grams: number;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  id: string;
  order_id: string;
  assigned_to: string;
  assigned_by: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  due_at: string | null;
  status: TaskStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskChecklistRow {
  id: string;
  task_id: string;
  label: string;
  is_required: number;
  is_checked: number;
  checked_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ReportRow {
  id: string;
  task_id: string;
  order_id: string;
  created_by: string;
  note: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportImageRow {
  id: string;
  report_id: string;
  order_id: string;
  task_id: string;
  r2_key: string;
  image_url: string;
  uploaded_by: string;
  created_at: string;
}

export interface InventoryRow {
  id: string;
  product_variant_id: string;
  sku: string;
  quantity_on_hand: number;
  low_stock_threshold: number;
  updated_at: string;
}

export interface InventoryTransactionRow {
  id: string;
  product_variant_id: string;
  sku: string;
  quantity: number;
  type: InventoryTxType;
  reference_type: string | null;
  reference_id: string | null;
  created_by: string;
  note: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: string;
  reference_type: string | null;
  reference_id: string | null;
  is_read: number;
  created_at: string;
}

export interface PaymentRow {
  id: string;
  order_id: string;
  customer_id: string;
  amount: number;
  method: string | null;
  note: string | null;
  paid_at: string;
  created_by: string | null;
  created_at: string;
}

export interface InstallationRow {
  id: string;
  order_id: string;
  customer_id: string;
  equipment: string;
  serial_number: string | null;
  location: string | null;
  scheduled_at: string | null;
  technician_id: string | null;
  assigned_by: string | null;
  note: string | null;
  status: InstallationStatus;
  started_at: string | null;
  completed_at: string | null;
  handed_over_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstallationChecklistRow {
  id: string;
  installation_id: string;
  label: string;
  is_required: number;
  is_checked: number;
  checked_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: string | null;
  created_at: string;
}
