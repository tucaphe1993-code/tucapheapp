-- 009_product_types_devices.sql
-- Phase: mở rộng Product/Kho để quản lý đồng thời cà phê VÀ máy pha/máy
-- xay/thiết bị/linh kiện/dịch vụ, cộng nền tảng Device/Serial cho máy.
--
-- An toàn/backward-compatible: product_variants và order_items được TẠO
-- LẠI (không xóa dữ liệu) vì SQLite không cho sửa CHECK/NOT NULL constraint
-- bằng ALTER TABLE — form/packaging/weight_grams chỉ còn bắt buộc có giá
-- trị hợp lệ CHO CÀ PHÊ (kiểm tra ở application code), NULL cho các loại
-- sản phẩm khác. Toàn bộ dữ liệu cũ được copy nguyên vẹn.
--
-- D1 luôn bật foreign_keys enforcement (PRAGMA foreign_keys=OFF không có
-- tác dụng trong 1 migration) — nên KHÔNG thể DROP một bảng còn được bảng
-- khác REFERENCES tới. Vì product_variants là "cha" của order_items,
-- inventory, inventory_transactions, customer_prices, thứ tự bắt buộc là:
--   1) đổi tên các bảng cũ ra chỗ khác (SQLite tự sửa lại FK text của các
--      bảng khác trỏ theo tên mới này),
--   2) tạo bảng mới đúng tên cũ + copy dữ liệu (FK giờ trỏ đúng bảng mới),
--   3) xóa các bảng "_old" theo đúng thứ tự con trước cha sau.

ALTER TABLE product_variants RENAME TO product_variants_old;
ALTER TABLE order_items RENAME TO order_items_old;
ALTER TABLE inventory RENAME TO inventory_old;
ALTER TABLE inventory_transactions RENAME TO inventory_transactions_old;
ALTER TABLE customer_prices RENAME TO customer_prices_old;

-- Renaming a table keeps its explicitly-named indexes (just now attached
-- to the "_old" table) — drop them so the same index names can be reused
-- on the recreated tables below.
DROP INDEX idx_product_variants_product_id;
DROP INDEX idx_product_variants_sku;
DROP INDEX idx_order_items_order_id;
DROP INDEX idx_order_items_product_variant_id;
DROP INDEX idx_inventory_transactions_sku;
DROP INDEX idx_inventory_transactions_product_variant_id;
DROP INDEX idx_inventory_transactions_reference;
DROP INDEX idx_inventory_transactions_issue_once;
DROP INDEX idx_customer_prices_customer_id;

ALTER TABLE products ADD COLUMN product_type TEXT NOT NULL DEFAULT 'COFFEE'
  CHECK (product_type IN ('COFFEE', 'BREWER', 'GRINDER', 'EQUIPMENT', 'ACCESSORY', 'SERVICE'));

CREATE TABLE product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  form TEXT,
  packaging TEXT,
  weight_grams INTEGER,
  sku TEXT NOT NULL UNIQUE,
  unit TEXT,
  unit_price INTEGER NOT NULL DEFAULT 0,
  cost_price INTEGER NOT NULL DEFAULT 0,
  brand TEXT,
  model TEXT,
  supplier TEXT,
  warranty_months INTEGER,
  requires_serial INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (product_id, form, packaging, weight_grams)
);

INSERT INTO product_variants
  (id, product_id, form, packaging, weight_grams, sku, unit, unit_price, cost_price, is_active, created_at, updated_at)
SELECT id, product_id, form, packaging, weight_grams, sku, 'Túi', unit_price, cost_price, is_active, created_at, updated_at
FROM product_variants_old;

CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);

-- order_items.form/packaging/weight_grams were NOT NULL (coffee-only) —
-- machine/device line items don't have those, so they must become nullable.
CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  product_variant_id TEXT NOT NULL REFERENCES product_variants(id),
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  form TEXT,
  packaging TEXT,
  weight_grams INTEGER,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL,
  line_total INTEGER NOT NULL,
  device_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO order_items
  (id, order_id, product_variant_id, sku, product_name, form, packaging, weight_grams, quantity, unit_price, line_total, created_at, updated_at)
SELECT id, order_id, product_variant_id, sku, product_name, form, packaging, weight_grams, quantity, unit_price, line_total, created_at, updated_at
FROM order_items_old;

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_variant_id ON order_items(product_variant_id);

-- inventory / inventory_transactions / customer_prices: schema unchanged,
-- only recreated so their FK repoints at the new product_variants table.
CREATE TABLE inventory (
  id TEXT PRIMARY KEY,
  product_variant_id TEXT NOT NULL UNIQUE REFERENCES product_variants(id),
  sku TEXT NOT NULL UNIQUE,
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO inventory (id, product_variant_id, sku, quantity_on_hand, low_stock_threshold, updated_at)
SELECT id, product_variant_id, sku, quantity_on_hand, low_stock_threshold, updated_at FROM inventory_old;

CREATE TABLE inventory_transactions (
  id TEXT PRIMARY KEY,
  product_variant_id TEXT NOT NULL REFERENCES product_variants(id),
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('RECEIVE', 'ISSUE', 'ADJUSTMENT')),
  reference_type TEXT,
  reference_id TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO inventory_transactions
  (id, product_variant_id, sku, quantity, type, reference_type, reference_id, created_by, note, created_at)
SELECT id, product_variant_id, sku, quantity, type, reference_type, reference_id, created_by, note, created_at
FROM inventory_transactions_old;

CREATE INDEX idx_inventory_transactions_sku ON inventory_transactions(sku);
CREATE INDEX idx_inventory_transactions_product_variant_id ON inventory_transactions(product_variant_id);
CREATE INDEX idx_inventory_transactions_reference ON inventory_transactions(reference_type, reference_id);
CREATE UNIQUE INDEX idx_inventory_transactions_issue_once
  ON inventory_transactions(reference_type, reference_id)
  WHERE type = 'ISSUE';

CREATE TABLE customer_prices (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  product_variant_id TEXT NOT NULL REFERENCES product_variants(id),
  unit_price INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (customer_id, product_variant_id)
);

INSERT INTO customer_prices (id, customer_id, product_variant_id, unit_price, created_at, updated_at)
SELECT id, customer_id, product_variant_id, unit_price, created_at, updated_at FROM customer_prices_old;

CREATE INDEX idx_customer_prices_customer_id ON customer_prices(customer_id);

-- Now safe: nothing left references the "_old" tables (children dropped
-- first, then the product_variants_old parent).
DROP TABLE customer_prices_old;
DROP TABLE inventory_transactions_old;
DROP TABLE inventory_old;
DROP TABLE order_items_old;
DROP TABLE product_variants_old;

-- ============ DEVICES (Serial-tracked units) ============
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  product_variant_id TEXT NOT NULL REFERENCES product_variants(id),
  serial_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'IN_STOCK' CHECK (status IN (
    'IN_STOCK', 'SOLD', 'AWAITING_INSTALL', 'INSTALLING', 'IN_USE',
    'UNDER_WARRANTY', 'IN_REPAIR', 'RECALLED', 'RETIRED'
  )),
  supplier TEXT,
  cost_price INTEGER,
  order_id TEXT REFERENCES orders(id),
  order_item_id TEXT REFERENCES order_items(id),
  customer_id TEXT REFERENCES customers(id),
  sold_at TEXT,
  handed_over_at TEXT,
  warranty_start_date TEXT,
  warranty_end_date TEXT,
  note TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_devices_product_id ON devices(product_id);
CREATE INDEX idx_devices_product_variant_id ON devices(product_variant_id);
CREATE INDEX idx_devices_customer_id ON devices(customer_id);
CREATE INDEX idx_devices_order_id ON devices(order_id);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_serial_number ON devices(serial_number);

-- ============ DEVICE HISTORY ============
CREATE TABLE device_history (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id),
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  order_id TEXT REFERENCES orders(id),
  customer_id TEXT REFERENCES customers(id),
  note TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_device_history_device_id ON device_history(device_id);

-- ============ LINK INSTALLATIONS TO A DEVICE ============
ALTER TABLE installations ADD COLUMN device_id TEXT REFERENCES devices(id);
