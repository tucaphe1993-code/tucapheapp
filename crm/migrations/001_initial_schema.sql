-- 001_initial_schema.sql
-- Tú Cà Phê CRM — core schema (Cloudflare D1 / SQLite)
-- ID strategy: TEXT UUID (crypto.randomUUID(), generated in application code)
-- Timestamps: TEXT ISO8601 UTC, default via SQLite datetime('now')

PRAGMA foreign_keys = ON;

-- ============ USERS ============
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'EMPLOYEE')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ SESSIONS ============
-- Server-side sessions backing the login cookie (opaque token; only its hash is stored)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ CUSTOMERS ============
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  province TEXT,
  note TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ PRODUCTS ============
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE, -- short SKU prefix, e.g. "CB" for Crema Blend
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ PRODUCT VARIANTS (SKU) ============
-- form/packaging/weight_grams define the variant; weight_grams is a free integer
-- so new sizes (2000g, 5000g, 10000g...) need no schema change.
CREATE TABLE product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  form TEXT NOT NULL CHECK (form IN ('HAT', 'BOT')),
  packaging TEXT NOT NULL CHECK (packaging IN ('TUI_XANH', 'TUI_ZIP')),
  weight_grams INTEGER NOT NULL CHECK (weight_grams > 0),
  sku TEXT NOT NULL UNIQUE,
  unit_price INTEGER NOT NULL DEFAULT 0,
  cost_price INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (product_id, form, packaging, weight_grams)
);

-- ============ ORDERS ============
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_code TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  customer_phone_snapshot TEXT,
  customer_address_snapshot TEXT,
  delivery_date TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
    status IN ('DRAFT', 'CONFIRMED', 'PACKING', 'PACKED', 'SHIPPED', 'COMPLETED', 'CANCELLED')
  ),
  total_amount INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id),
  inventory_issued_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ ORDER ITEMS ============
CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  product_variant_id TEXT NOT NULL REFERENCES product_variants(id),
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  form TEXT NOT NULL,
  packaging TEXT NOT NULL,
  weight_grams INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL,
  line_total INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ TASKS ============
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  assigned_to TEXT NOT NULL REFERENCES users(id),
  assigned_by TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ TASK CHECKLISTS ============
CREATE TABLE task_checklists (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  label TEXT NOT NULL,
  is_required INTEGER NOT NULL DEFAULT 1,
  is_checked INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ REPORTS ============
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  note TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ REPORT IMAGES ============
CREATE TABLE report_images (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES reports(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  task_id TEXT NOT NULL REFERENCES tasks(id),
  r2_key TEXT NOT NULL,
  image_url TEXT NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ INVENTORY (current stock cache, per SKU) ============
-- Source of truth is inventory_transactions; this table is a maintained
-- projection kept in sync in the same write as each transaction insert.
CREATE TABLE inventory (
  id TEXT PRIMARY KEY,
  product_variant_id TEXT NOT NULL UNIQUE REFERENCES product_variants(id),
  sku TEXT NOT NULL UNIQUE,
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ INVENTORY TRANSACTIONS ============
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

-- ============ NOTIFICATIONS ============
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
