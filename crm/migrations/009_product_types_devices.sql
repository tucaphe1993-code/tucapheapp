-- 009_product_types_devices.sql
-- Phase: mở rộng Product/Kho để quản lý đồng thời cà phê VÀ máy pha/máy
-- xay/thiết bị/linh kiện/dịch vụ, cộng nền tảng Device/Serial cho máy.
--
-- An toàn/backward-compatible:
--  - products.product_type mặc định 'COFFEE' -> mọi sản phẩm hiện tại vẫn
--    là cà phê, không đổi hành vi.
--  - product_variants VÀ order_items được TẠO LẠI (không xóa dữ liệu) vì
--    SQLite không cho sửa CHECK/NOT NULL constraint bằng ALTER TABLE;
--    form/packaging/weight_grams chỉ còn bắt buộc có giá trị hợp lệ CHO CÀ
--    PHÊ (kiểm tra ở application code), NULL cho các loại sản phẩm khác.
--    Toàn bộ dữ liệu cũ được copy nguyên vẹn.
--  - installations chỉ thêm cột nullable device_id (không cần tạo lại vì
--    các cột liên quan vốn đã nullable).

PRAGMA foreign_keys = OFF;

ALTER TABLE products ADD COLUMN product_type TEXT NOT NULL DEFAULT 'COFFEE'
  CHECK (product_type IN ('COFFEE', 'BREWER', 'GRINDER', 'EQUIPMENT', 'ACCESSORY', 'SERVICE'));

CREATE TABLE product_variants_new (
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

INSERT INTO product_variants_new
  (id, product_id, form, packaging, weight_grams, sku, unit, unit_price, cost_price, is_active, created_at, updated_at)
SELECT id, product_id, form, packaging, weight_grams, sku, 'Túi', unit_price, cost_price, is_active, created_at, updated_at
FROM product_variants;

DROP TABLE product_variants;
ALTER TABLE product_variants_new RENAME TO product_variants;

CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);

-- order_items.form/packaging/weight_grams were NOT NULL (coffee-only) —
-- machine/device line items don't have those, so they must become nullable.
CREATE TABLE order_items_new (
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

INSERT INTO order_items_new
  (id, order_id, product_variant_id, sku, product_name, form, packaging, weight_grams, quantity, unit_price, line_total, created_at, updated_at)
SELECT id, order_id, product_variant_id, sku, product_name, form, packaging, weight_grams, quantity, unit_price, line_total, created_at, updated_at
FROM order_items;

DROP TABLE order_items;
ALTER TABLE order_items_new RENAME TO order_items;

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_variant_id ON order_items(product_variant_id);

PRAGMA foreign_keys = ON;

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

-- ============ LINK ORDER ITEMS / INSTALLATIONS TO A DEVICE ============
-- order_items.device_id was already added above when the table was
-- recreated; installations' columns were already nullable so a plain
-- ALTER is enough there.
ALTER TABLE installations ADD COLUMN device_id TEXT REFERENCES devices(id);
