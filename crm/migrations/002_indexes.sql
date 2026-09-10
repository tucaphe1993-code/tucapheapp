-- 002_indexes.sql
-- Indexes for common lookups + data-integrity guards (partial unique indexes)

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_is_deleted ON customers(is_deleted);

CREATE INDEX idx_products_is_active ON products(is_active);

CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);

CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_order_code ON orders(order_code);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_variant_id ON order_items(product_variant_id);

CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_order_id ON tasks(order_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_at ON tasks(due_at);

-- A single order may not have more than one active (non-cancelled) packing task.
CREATE UNIQUE INDEX idx_tasks_order_unique_active
  ON tasks(order_id)
  WHERE status != 'CANCELLED';

CREATE INDEX idx_task_checklists_task_id ON task_checklists(task_id);

CREATE INDEX idx_reports_order_id ON reports(order_id);

CREATE INDEX idx_report_images_report_id ON report_images(report_id);
CREATE INDEX idx_report_images_order_id ON report_images(order_id);
CREATE INDEX idx_report_images_task_id ON report_images(task_id);

CREATE INDEX idx_inventory_transactions_sku ON inventory_transactions(sku);
CREATE INDEX idx_inventory_transactions_product_variant_id ON inventory_transactions(product_variant_id);
CREATE INDEX idx_inventory_transactions_reference ON inventory_transactions(reference_type, reference_id);

-- An order may only ever be ISSUEd from inventory once (blocks double ship-out).
CREATE UNIQUE INDEX idx_inventory_transactions_issue_once
  ON inventory_transactions(reference_type, reference_id)
  WHERE type = 'ISSUE';

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
