-- 012_green_coffee_roasting.sql
-- Giai đoạn 1 (Kho): thêm 2 "công đoạn cà phê" mới — "Cà phê nhân xanh"
-- (nguyên liệu thô, tồn theo KG lẻ) và "Cà phê rang" (thành phẩm rời, CHƯA
-- đóng gói) — tách biệt hẳn với cà phê đóng gói hiện có. Cộng module
-- Rang/Sản xuất: nơi DUY NHẤT áp dụng hao hụt rang (không áp dụng lúc nhập
-- kho, không áp dụng lúc bán).
--
-- QUYẾT ĐỊNH AN TOÀN QUAN TRỌNG: KHÔNG mở rộng CHECK constraint của cột
-- products.product_type (dù ban đầu định làm vậy) — vì SQLite không cho
-- sửa CHECK bằng ALTER TABLE, bắt buộc phải rename+recreate bảng products.
-- Đã kiểm chứng thực nghiệm: products là bảng CHA của product_variants và
-- devices (2 bảng này còn có RẤT NHIỀU bảng con khác nữa: order_items,
-- inventory, inventory_transactions, customer_prices) — rename products sẽ
-- khiến SQLite tự viết lại định nghĩa FK của product_variants/devices trỏ
-- sang "products_old", và nếu không rename+recreate CẢ DÂY CHUYỀN đó theo,
-- sau khi DROP TABLE products_old thì MỌI INSERT vào product_variants/
-- devices sẽ lỗi "no such table: products_old" — hỏng toàn bộ nghiệp vụ
-- nhập kho/bán hàng. Rủi ro này KHÔNG chấp nhận được cho dữ liệu production.
--
-- Thay vào đó: thêm 1 cột MỚI, NULLABLE, có CHECK riêng — hoàn toàn dùng
-- ALTER TABLE ADD COLUMN (không đụng bảng nào khác, không rename gì cả).
-- Cà phê nhân xanh/cà phê rang rời vẫn dùng product_type = 'COFFEE' như cũ,
-- chỉ thêm coffee_stage để phân biệt công đoạn:
--   coffee_stage IS NULL      -> cà phê đóng gói (hành vi hiện tại, không đổi)
--   coffee_stage = 'GREEN'    -> cà phê nhân xanh (tồn theo KG lẻ)
--   coffee_stage = 'ROASTED'  -> cà phê rang rời, chưa đóng gói (tồn theo KG lẻ)
ALTER TABLE products ADD COLUMN coffee_stage TEXT CHECK (coffee_stage IN ('GREEN', 'ROASTED'));

-- ============ inventory_transactions.type: + ROAST_PRODUCTION, ROAST_CONSUMPTION ============
-- An toàn để rename+recreate: đã kiểm tra, KHÔNG có bảng nào REFERENCES
-- inventory_transactions (bảng log, không phải bảng cha của ai).
ALTER TABLE inventory_transactions RENAME TO inventory_transactions_old;
DROP INDEX idx_inventory_transactions_sku;
DROP INDEX idx_inventory_transactions_product_variant_id;
DROP INDEX idx_inventory_transactions_reference;
DROP INDEX idx_inventory_transactions_issue_once;

CREATE TABLE inventory_transactions (
  id TEXT PRIMARY KEY,
  product_variant_id TEXT NOT NULL REFERENCES product_variants(id),
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'RECEIVE', 'ISSUE', 'ADJUSTMENT', 'ROAST_PRODUCTION', 'ROAST_CONSUMPTION'
  )),
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

DROP TABLE inventory_transactions_old;

-- ============ ROAST COST CONFIG (1 dòng duy nhất, giống order_sequence) ============
-- Toàn bộ giá trị admin tự cấu hình được, KHÔNG hard-code trong code.
-- gas_cost_per_kg_green: đồng/kg NHÂN XANH (vd 1.700.000đ bình gas 45kg,
--   năng lực 1.000kg -> 1.700đ/kg nhân xanh — admin tự tính rồi nhập vào).
-- packaging_cost_per_kg_finished: đồng/kg THÀNH PHẨM.
-- labor_cost_mode + labor_cost_value: nhân công CHƯA có mặc định đoán mò —
--   nếu chưa cấu hình, labor_cost_value = 0.
CREATE TABLE roast_cost_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  default_shrinkage_percent REAL NOT NULL DEFAULT 20,
  gas_cost_per_kg_green INTEGER NOT NULL DEFAULT 0,
  packaging_cost_per_kg_finished INTEGER NOT NULL DEFAULT 0,
  labor_cost_mode TEXT NOT NULL DEFAULT 'PER_KG_FINISHED'
    CHECK (labor_cost_mode IN ('PER_KG_FINISHED', 'PER_KG_GREEN', 'PER_HOUR', 'PER_DAY')),
  labor_cost_value INTEGER NOT NULL DEFAULT 0,
  other_cost_per_kg_finished INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT REFERENCES users(id)
);
INSERT INTO roast_cost_config (id) VALUES (1);

-- ============ ROAST BATCH SEQUENCE (MR-0001, MR-0002, ... giống order_sequence) ============
CREATE TABLE roast_batch_sequence (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_value INTEGER NOT NULL
);
INSERT INTO roast_batch_sequence (id, next_value) VALUES (1, 1);

-- ============ ROAST BATCHES ============
-- DRAFT: chỉ tính toán/xem trước, CHƯA đụng tồn kho.
-- CONFIRMED: trừ nhân xanh (ROAST_CONSUMPTION), cộng cà phê rang
--   (ROAST_PRODUCTION) — đúng 1 lần duy nhất, không cho sửa/xóa sau đó.
CREATE TABLE roast_batches (
  id TEXT PRIMARY KEY,
  batch_code TEXT NOT NULL UNIQUE,
  green_variant_id TEXT NOT NULL REFERENCES product_variants(id),
  roasted_variant_id TEXT NOT NULL REFERENCES product_variants(id),
  input_kg REAL NOT NULL CHECK (input_kg > 0),
  shrinkage_percent REAL NOT NULL,
  finished_kg REAL NOT NULL,
  shrinkage_kg REAL NOT NULL,
  green_bean_cost INTEGER NOT NULL DEFAULT 0,
  gas_cost INTEGER NOT NULL DEFAULT 0,
  labor_cost INTEGER NOT NULL DEFAULT 0,
  packaging_cost INTEGER NOT NULL DEFAULT 0,
  other_cost INTEGER NOT NULL DEFAULT 0,
  total_cost INTEGER NOT NULL DEFAULT 0,
  cost_per_kg INTEGER NOT NULL DEFAULT 0,
  labor_hours REAL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CONFIRMED')),
  roasted_by TEXT REFERENCES users(id),
  note TEXT,
  confirmed_at TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_roast_batches_green_variant_id ON roast_batches(green_variant_id);
CREATE INDEX idx_roast_batches_roasted_variant_id ON roast_batches(roasted_variant_id);
CREATE INDEX idx_roast_batches_status ON roast_batches(status);
CREATE INDEX idx_roast_batches_created_at ON roast_batches(created_at);

-- Một mẻ rang CONFIRMED chỉ được phép sinh giao dịch kho đúng 1 lần
-- (giống hệt cơ chế idx_inventory_transactions_issue_once cho đơn hàng).
CREATE UNIQUE INDEX idx_inventory_transactions_roast_once
  ON inventory_transactions(reference_type, reference_id)
  WHERE type = 'ROAST_PRODUCTION';
