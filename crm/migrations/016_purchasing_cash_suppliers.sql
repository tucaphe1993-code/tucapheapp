-- 016_purchasing_cash_suppliers.sql
-- Giai đoạn "xây lại từ đầu" theo mô hình ERP mới (Bán hàng/Mua hàng/Kho/
-- Thu-Chi/Công nợ), phần lõi mới hoàn toàn chưa từng có trong hệ thống:
--   - Nhà cung cấp (danh mục riêng, không còn chữ tự do)
--   - Phương thức thanh toán, Đơn vị tính (danh mục quản lý được)
--   - Mua hàng: Đơn mua nhiều dòng hàng + Công nợ phải trả NCC
--   - Thu/Chi: Phiếu thu/chi thống nhất (Sổ quỹ = SUM chạy trên bảng này)
-- Chỉ 1 kho (theo xác nhận của chủ doanh nghiệp) nên KHÔNG có khái niệm
-- đa kho/chuyển kho ở đây.
--
-- Toàn bộ là bảng MỚI hoặc ALTER TABLE ADD COLUMN — không rename/xóa bảng
-- nào đang có, không đụng tới orders/order_items/inventory hiện tại.

-- ============ DANH MỤC: NHÀ CUNG CẤP ============
CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  credit_limit INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_suppliers_name ON suppliers(name);

CREATE TABLE supplier_sequence (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_value INTEGER NOT NULL
);
INSERT INTO supplier_sequence (id, next_value) VALUES (1, 0);

-- Hạn mức công nợ cho khách hàng (đối xứng với suppliers.credit_limit) —
-- dùng cho cảnh báo "Có nợ quá hạn" ở trang Công nợ, giống bản ERP mẫu.
ALTER TABLE customers ADD COLUMN credit_limit INTEGER NOT NULL DEFAULT 0;

-- ============ DANH MỤC: PHƯƠNG THỨC THANH TOÁN ============
-- Thay cho hằng số PAYMENT_METHODS cứng trong code — admin tự thêm/sửa
-- được. code là khóa chính tự nhiên (TM/CK/QR/CN/COD/KHAC), không cần
-- thêm cột id UUID riêng.
CREATE TABLE payment_methods (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
INSERT INTO payment_methods (code, name, sort_order) VALUES
  ('TM', 'Tiền mặt', 1),
  ('CK', 'Chuyển khoản', 2),
  ('QR', 'Quét QR', 3),
  ('CN', 'Công nợ', 4),
  ('COD', 'Thu hộ (COD)', 5),
  ('KHAC', 'Khác', 6);

-- ============ DANH MỤC: ĐƠN VỊ TÍNH ============
CREATE TABLE units (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
INSERT INTO units (code, name, sort_order) VALUES
  ('CAI', 'Cái', 1),
  ('KG', 'Kg', 2),
  ('GRAM', 'Gram', 3),
  ('TUI', 'Túi', 4),
  ('HOP', 'Hộp', 5),
  ('CHAI', 'Chai', 6),
  ('CUON', 'Cuộn', 7),
  ('RAM', 'Ram', 8),
  ('XAP', 'Xấp', 9),
  ('MAY', 'Máy', 10),
  ('BO', 'Bộ', 11),
  ('CHIEC', 'Chiếc', 12),
  ('LAN', 'Lần', 13),
  ('DICH_VU', 'Dịch vụ', 14);

-- ============ HÀNG HÓA: mở rộng Nhóm hàng + Barcode ============
-- Cột mới, nullable, không CHECK — an toàn tuyệt đối bằng ADD COLUMN.
ALTER TABLE product_variants ADD COLUMN category TEXT;
ALTER TABLE product_variants ADD COLUMN barcode TEXT;

-- ============ ĐƠN BÁN: gắn phương thức thanh toán mặc định ============
-- Chỉ để hiển thị cột "PTTT" trên danh sách đơn bán như bản ERP mẫu —
-- việc thu tiền thực tế vẫn qua bảng payments sẵn có, không đổi.
ALTER TABLE orders ADD COLUMN payment_method_code TEXT REFERENCES payment_methods(code);

-- ============ MUA HÀNG: ĐƠN MUA (nhiều dòng hàng) ============
CREATE TABLE purchase_sequence (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_value INTEGER NOT NULL
);
INSERT INTO purchase_sequence (id, next_value) VALUES (1, 1);

CREATE TABLE purchase_orders (
  id TEXT PRIMARY KEY,
  po_code TEXT NOT NULL UNIQUE,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED')),
  payment_method_code TEXT REFERENCES payment_methods(code),
  note TEXT,
  total_amount INTEGER NOT NULL DEFAULT 0,
  -- CONFIRMED mới thật sự nhập kho + phát sinh công nợ — giống pattern
  -- inventory_issued_at của orders (CAS: WHERE inventory_received_at IS NULL).
  inventory_received_at TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);

CREATE TABLE purchase_order_items (
  id TEXT PRIMARY KEY,
  purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id),
  product_variant_id TEXT NOT NULL REFERENCES product_variants(id),
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  -- REAL để mua được số lẻ (VD nhân xanh theo kg) — giống order_items
  -- nhưng nới lỏng kiểu dữ liệu, validate số nguyên/thập phân ở service.
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit_cost INTEGER NOT NULL,
  line_total INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_purchase_order_items_po_id ON purchase_order_items(purchase_order_id);

-- ============ CÔNG NỢ PHẢI TRẢ: THANH TOÁN NHÀ CUNG CẤP ============
-- Đối xứng với payments (công nợ phải thu) — còn nợ NCC luôn tính từ
-- purchase_orders.total_amount - SUM(supplier_payments.amount), không
-- lưu cột riêng, để không bao giờ lệch dữ liệu (giống nguyên tắc payments).
CREATE TABLE supplier_payments (
  id TEXT PRIMARY KEY,
  purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id),
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  amount INTEGER NOT NULL,
  method TEXT,
  note TEXT,
  paid_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_supplier_payments_po_id ON supplier_payments(purchase_order_id);
CREATE INDEX idx_supplier_payments_supplier_id ON supplier_payments(supplier_id);

-- ============ THU / CHI: SỔ QUỸ THỐNG NHẤT ============
-- MỌI dòng tiền ra/vào của công ty đi qua đúng 1 bảng này — kể cả các
-- khoản tự động sinh từ đơn bán (payments) / đơn mua (supplier_payments)
-- lẫn phiếu tay (thu khác/chi phí hoạt động không gắn chứng từ nào).
-- "Sổ quỹ / Dòng tiền" = SELECT ... SUM(...) OVER (ORDER BY voucher_date)
-- trên chính bảng này — không cần bảng số dư riêng, không bao giờ lệch.
CREATE TABLE cash_voucher_sequence (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_receipt_value INTEGER NOT NULL,
  next_payment_value INTEGER NOT NULL
);
INSERT INTO cash_voucher_sequence (id, next_receipt_value, next_payment_value) VALUES (1, 1, 1);

CREATE TABLE cash_vouchers (
  id TEXT PRIMARY KEY,
  voucher_code TEXT NOT NULL UNIQUE,
  direction TEXT NOT NULL CHECK (direction IN ('IN', 'OUT')),
  voucher_date TEXT NOT NULL DEFAULT (datetime('now')),
  customer_id TEXT REFERENCES customers(id),
  supplier_id TEXT REFERENCES suppliers(id),
  category TEXT NOT NULL CHECK (category IN ('SALE_ORDER', 'PURCHASE_ORDER', 'OTHER')),
  -- Nhóm chi phí — chỉ có ý nghĩa với phiếu chi loại OTHER (chi phí hoạt
  -- động: thuê mặt bằng, lương, marketing, điện nước...).
  expense_group TEXT,
  reference_type TEXT,
  reference_id TEXT,
  payment_method_code TEXT REFERENCES payment_methods(code),
  amount INTEGER NOT NULL CHECK (amount > 0),
  description TEXT,
  note TEXT,
  -- 1 = tự động sinh khi ghi nhận thanh toán trên đơn bán/đơn mua,
  -- 0 = admin tạo tay (Thu khác/Chi phí hoạt động).
  is_auto INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_cash_vouchers_direction ON cash_vouchers(direction);
CREATE INDEX idx_cash_vouchers_voucher_date ON cash_vouchers(voucher_date);
CREATE INDEX idx_cash_vouchers_reference ON cash_vouchers(reference_type, reference_id);
