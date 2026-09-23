-- 024_quotations.sql
-- Module "Báo giá" — tạo báo giá cho khách, lưu lịch sử, xuất PDF, gửi qua
-- link công khai, chuyển thành đơn hàng. 100% bảng mới — không đụng tới
-- schema đơn hàng/khách hàng/sản phẩm hiện có, chỉ thêm 2 cột nullable vào
-- customers cho thông tin công ty (cần khi báo giá cho khách B2B).

ALTER TABLE customers ADD COLUMN company_name TEXT;
ALTER TABLE customers ADD COLUMN tax_code TEXT;

-- Bộ đếm "Mã báo giá" (BG-0001, BG-0002, ...) — cùng pattern order_sequence.
CREATE TABLE quote_sequence (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_value INTEGER NOT NULL
);
INSERT INTO quote_sequence (id, next_value) VALUES (1, 1);

CREATE TABLE quotations (
  id TEXT PRIMARY KEY,
  quote_code TEXT NOT NULL UNIQUE,
  customer_id TEXT REFERENCES customers(id),
  -- Snapshot thông tin khách hàng tại thời điểm báo giá — không phụ thuộc
  -- vào việc sau này khách đổi tên/địa chỉ trong hồ sơ (giống cách orders
  -- snapshot customer_phone_snapshot/customer_address_snapshot).
  customer_name_snapshot TEXT NOT NULL,
  customer_phone_snapshot TEXT,
  customer_company_snapshot TEXT,
  customer_address_snapshot TEXT,
  customer_tax_code_snapshot TEXT,
  customer_email_snapshot TEXT,
  quote_date TEXT NOT NULL,
  valid_until TEXT,
  -- Chỉ là nhãn phân loại hiển thị trên báo giá — KHÔNG tự động tra/đổi
  -- đơn giá theo loại này hay theo số lượng (hệ thống chưa có bảng giá
  -- theo bậc số lượng). Đơn giá luôn do nhân viên nhập tay từng dòng.
  price_type TEXT NOT NULL DEFAULT 'RETAIL' CHECK (price_type IN ('RETAIL', 'WHOLESALE', 'AGENT', 'CUSTOM')),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'
  )),
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  vat_amount INTEGER NOT NULL DEFAULT 0,
  shipping_fee INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  reject_reason TEXT,
  -- Token công khai RIÊNG với id — không dùng thẳng khóa chính làm URL để
  -- có thể thu hồi/luân chuyển link mà không đụng tới bản ghi (khác với
  -- precedent /warranty/[orderId] đang dùng thẳng orders.id).
  public_token TEXT NOT NULL UNIQUE,
  assigned_to TEXT REFERENCES users(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  converted_order_id TEXT REFERENCES orders(id),
  sent_at TEXT,
  viewed_at TEXT,
  accepted_at TEXT,
  rejected_at TEXT,
  converted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX idx_quotations_status ON quotations(status);
CREATE INDEX idx_quotations_public_token ON quotations(public_token);

CREATE TABLE quotation_items (
  id TEXT PRIMARY KEY,
  quotation_id TEXT NOT NULL REFERENCES quotations(id),
  -- Cho phép dòng báo giá KHÔNG gắn SKU cụ thể (hàng/dịch vụ báo giá tự
  -- do, ví dụ "Chi phí lắp đặt") — vẫn ưu tiên chọn từ danh mục có sẵn.
  product_variant_id TEXT REFERENCES product_variants(id),
  product_name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'Cái',
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  vat_percent INTEGER NOT NULL DEFAULT 0,
  line_total INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_quotation_items_quotation_id ON quotation_items(quotation_id);

-- Timeline: "23/09/2026 - Đã gửi khách" ... user_id NULL nghĩa là khách tự
-- thao tác qua link công khai (đồng ý/từ chối), không phải nhân viên.
CREATE TABLE quotation_events (
  id TEXT PRIMARY KEY,
  quotation_id TEXT NOT NULL REFERENCES quotations(id),
  action TEXT NOT NULL,
  note TEXT,
  user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_quotation_events_quotation_id ON quotation_events(quotation_id);
