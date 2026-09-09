-- D1 schema cho backend đồng bộ Sản phẩm/Tồn kho + Đơn hàng.
-- Chạy: wrangler d1 execute tucaphe-db --file=./worker/schema.sql

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  icon TEXT,
  image TEXT,
  short_desc TEXT,
  description TEXT,
  specs TEXT,              -- JSON string, vd: {"Số group":"1","Công suất":"1400W"}
  variants TEXT,           -- JSON string, vd: {"weight":["1kg","5kg"],"grind":["Hạt","Xay phin"]} — chỉ cà phê dùng
  retail_price INTEGER NOT NULL,
  wholesale_price INTEGER NOT NULL,
  wholesale_min_kg INTEGER NOT NULL DEFAULT 1,
  stock INTEGER NOT NULL DEFAULT 0,
  badge TEXT,
  visible INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_company TEXT,
  address TEXT NOT NULL,
  province TEXT NOT NULL,
  note TEXT,
  total_kg REAL NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Mới',
  delivery_status TEXT NOT NULL DEFAULT 'Chưa giao',
  delivery_date_planned TEXT,
  delivery_date_actual TEXT,
  shipper_name TEXT,
  channel TEXT NOT NULL DEFAULT 'Website'
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id),
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  qty REAL NOT NULL,
  unit_price INTEGER NOT NULL,
  line_total INTEGER NOT NULL,
  price_type TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

CREATE TABLE IF NOT EXISTS stock_tx (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,        -- 'nhap' | 'xuat'
  item_type TEXT NOT NULL,   -- luôn 'product' (nguyên liệu không đồng bộ)
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  qty REAL NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  source TEXT NOT NULL,      -- 'manual' | 'order' | 'production'
  ref_id TEXT
);

CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
INSERT OR IGNORE INTO counters (name, value) VALUES ('order_seq', 0);
INSERT OR IGNORE INTO counters (name, value) VALUES ('stock_tx_seq', 0);
