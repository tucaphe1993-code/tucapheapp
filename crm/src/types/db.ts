export type Role = "ADMIN" | "EMPLOYEE";
export type UserStatus = "ACTIVE" | "DISABLED";

export type ProductForm = "HAT" | "BOT";
export type ProductPackaging = "TUI_XANH" | "TUI_ZIP";

export type ProductType = "COFFEE" | "BREWER" | "GRINDER" | "EQUIPMENT" | "ACCESSORY" | "SERVICE";

// Công đoạn của cà phê (chỉ áp dụng khi product_type = 'COFFEE'):
// NULL = đóng gói (hành vi mặc định/hiện tại), GREEN = nhân xanh, ROASTED =
// đã rang nhưng còn rời (chưa đóng gói). Cả hai đều tồn theo KG lẻ.
export type CoffeeStage = "GREEN" | "ROASTED" | null;

export type RoastBatchStatus = "DRAFT" | "CONFIRMED";
export type LaborCostMode = "PER_KG_FINISHED" | "PER_KG_GREEN" | "PER_HOUR" | "PER_DAY";

export type DeviceStatus =
  | "IN_STOCK"
  | "SOLD"
  | "AWAITING_INSTALL"
  | "INSTALLING"
  | "IN_USE"
  | "UNDER_WARRANTY"
  | "IN_REPAIR"
  | "RECALLED"
  | "RETIRED";

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

export type ProtocolStatus =
  | "PENDING_INSTALL"
  | "INSTALLING"
  | "PENDING_CONFIRMATION"
  | "HANDED_OVER"
  | "WARRANTY_ACTIVATED"
  | "COMPLETED";

export type ChecklistCategory = "INSTALL" | "GUIDE";

export type InstallationStatus =
  | "PENDING"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "HANDED_OVER"
  | "CANCELLED";

export type InventoryTxType =
  | "RECEIVE"
  | "ISSUE"
  | "ADJUSTMENT"
  | "ROAST_PRODUCTION"
  | "ROAST_CONSUMPTION"
  | "SALE";

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
  // Mã KH tự sinh (KH000, KH001...) — null cho khách hàng tạo trước
  // migration 017, luôn có giá trị từ đó trở đi.
  code: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  province: string | null;
  note: string | null;
  // Hạn mức công nợ — 0 nghĩa là không giới hạn (§ Công nợ phải thu).
  credit_limit: number;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

export interface SupplierRow {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  credit_limit: number;
  note: string | null;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethodRow {
  code: string;
  name: string;
  is_active: number;
  sort_order: number;
}

export interface UnitRow {
  code: string;
  name: string;
  is_active: number;
  sort_order: number;
}

export interface ProductRow {
  id: string;
  name: string;
  slug: string;
  code: string;
  description: string | null;
  product_type: ProductType;
  coffee_stage: CoffeeStage;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ProductVariantRow {
  id: string;
  product_id: string;
  form: ProductForm | null;
  packaging: ProductPackaging | null;
  weight_grams: number | null;
  sku: string;
  unit: string | null;
  unit_price: number;
  cost_price: number;
  brand: string | null;
  model: string | null;
  supplier: string | null;
  warranty_months: number | null;
  requires_serial: number;
  // Chỉ có ý nghĩa khi coffee_stage = 'ROASTED': SKU nhân xanh sẽ bị trừ
  // tồn khi bán SKU thành phẩm này (§ Bán hàng — quy đổi tự động, xem
  // sellFinishedCoffee trong lib/services/inventory.ts).
  source_green_variant_id: string | null;
  // Nhóm hàng + mã vạch — chỉ hiển thị/lọc, không ràng buộc gì (§ Danh mục).
  category: string | null;
  barcode: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface DeviceRow {
  id: string;
  product_id: string;
  product_variant_id: string;
  serial_number: string;
  status: DeviceStatus;
  supplier: string | null;
  cost_price: number | null;
  order_id: string | null;
  order_item_id: string | null;
  customer_id: string | null;
  sold_at: string | null;
  handed_over_at: string | null;
  warranty_start_date: string | null;
  warranty_end_date: string | null;
  note: string | null;
  received_at: string;
  created_at: string;
  updated_at: string;
}

export interface DeviceHistoryRow {
  id: string;
  device_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  order_id: string | null;
  customer_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
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
  vat_included: number;
  // Chỉ để hiển thị cột "PTTT" trên danh sách đơn — không ảnh hưởng tính
  // công nợ (vẫn luôn tính từ payments, xem migration 007/016).
  payment_method_code: string | null;
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
  form: ProductForm | null;
  packaging: ProductPackaging | null;
  weight_grams: number | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  device_id: string | null;
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
  // Nhập hàng (RECEIVE): thông tin hóa đơn đầu vào, chỉ tham khảo/lưu vết.
  supplier: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  unit_price: number | null;
  // Bán hàng (SALE): product_variant_id/sku/quantity ở trên luôn là SKU
  // NHÂN XANH bị trừ tồn — các cột dưới đây ghi lại SKU thành phẩm thực
  // bán, KG thành phẩm, khách hàng, giá và VAT phục vụ hóa đơn/lịch sử.
  finished_variant_id: string | null;
  finished_kg: number | null;
  customer_id: string | null;
  line_total: number | null;
  vat_percent: number | null;
  vat_amount: number | null;
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

export type PurchaseOrderStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

export interface PurchaseOrderRow {
  id: string;
  po_code: string;
  supplier_id: string;
  status: PurchaseOrderStatus;
  payment_method_code: string | null;
  note: string | null;
  total_amount: number;
  inventory_received_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItemRow {
  id: string;
  purchase_order_id: string;
  product_variant_id: string;
  sku: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
  created_at: string;
}

export interface SupplierPaymentRow {
  id: string;
  purchase_order_id: string;
  supplier_id: string;
  amount: number;
  method: string | null;
  note: string | null;
  paid_at: string;
  created_by: string | null;
  created_at: string;
}

export type CashVoucherDirection = "IN" | "OUT";
export type CashVoucherCategory = "SALE_ORDER" | "PURCHASE_ORDER" | "OTHER";

export interface CashVoucherRow {
  id: string;
  voucher_code: string;
  direction: CashVoucherDirection;
  voucher_date: string;
  customer_id: string | null;
  supplier_id: string | null;
  category: CashVoucherCategory;
  expense_group: string | null;
  reference_type: string | null;
  reference_id: string | null;
  payment_method_code: string | null;
  amount: number;
  description: string | null;
  note: string | null;
  is_auto: number;
  created_by: string | null;
  created_at: string;
}

export interface InstallationRow {
  id: string;
  order_id: string;
  customer_id: string;
  equipment: string;
  serial_number: string | null;
  device_id: string | null;
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

export interface HandoverProtocolRow {
  id: string;
  protocol_code: string;
  order_id: string;
  customer_id: string;
  status: ProtocolStatus;
  contact_name: string | null;
  contact_phone: string | null;
  install_address: string | null;
  note: string | null;
  technician_id: string | null;
  installed_at: string | null;
  device_condition: string | null;
  exception_note: string | null;
  handed_over_at: string | null;
  warranty_activated_at: string | null;
  warranty_activated_by: string | null;
  signature_a_data: string | null;
  signature_a_name: string | null;
  signature_a_signed_at: string | null;
  signature_b_data: string | null;
  signature_b_name: string | null;
  signature_b_signed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface HandoverProtocolDeviceRow {
  id: string;
  protocol_id: string;
  device_id: string | null;
  product_name: string;
  model: string | null;
  serial_number: string | null;
  quantity: number;
  condition: string | null;
  sort_order: number;
}

export interface HandoverProtocolAccessoryRow {
  id: string;
  protocol_id: string;
  name: string;
  quantity: number;
  note: string | null;
  sort_order: number;
}

export interface HandoverProtocolChecklistRow {
  id: string;
  protocol_id: string;
  category: ChecklistCategory;
  label: string;
  is_checked: number;
  note: string | null;
  checked_at: string | null;
  sort_order: number;
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

export interface RoastCostConfigRow {
  id: number;
  default_shrinkage_percent: number;
  gas_cost_per_kg_green: number;
  packaging_cost_per_kg_finished: number;
  labor_cost_mode: LaborCostMode;
  labor_cost_value: number;
  other_cost_per_kg_finished: number;
  updated_at: string;
  updated_by: string | null;
}

export interface RoastBatchRow {
  id: string;
  batch_code: string;
  green_variant_id: string;
  roasted_variant_id: string;
  input_kg: number;
  shrinkage_percent: number;
  finished_kg: number;
  shrinkage_kg: number;
  green_bean_cost: number;
  gas_cost: number;
  labor_cost: number;
  packaging_cost: number;
  other_cost: number;
  total_cost: number;
  cost_per_kg: number;
  labor_hours: number | null;
  status: RoastBatchStatus;
  roasted_by: string | null;
  note: string | null;
  confirmed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}
