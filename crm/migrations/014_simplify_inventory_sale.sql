-- 014_simplify_inventory_sale.sql
-- Thay thế hoàn toàn luồng "Mẻ rang" (roast_batches DRAFT/CONFIRMED) theo
-- yêu cầu mới của chủ doanh nghiệp: CHỈ theo dõi tồn kho NHÂN XANH, KHÔNG
-- có tồn kho thành phẩm riêng. Màn "Bán hàng" chỉ nhập KG thành phẩm bán
-- ra, hệ thống tự quy đổi ngược ra KG nhân xanh tiêu hao (theo tỷ lệ hao
-- hụt/chuyển đổi đã có sẵn ở roast_cost_config.default_shrinkage_percent
-- — KHÔNG tạo bảng cấu hình mới, tái dùng đúng field đã có) và trừ THẲNG
-- vào tồn nhân xanh, không còn đi qua bước "mẻ rang" trung gian nữa.
--
-- KHÔNG xóa roast_batches / roast_cost_config / roast_batch_sequence hay
-- bất kỳ dữ liệu nào đã có (tuân thủ yêu cầu "KHÔNG được tự ý xóa dữ liệu
-- hoặc reset database") — các bảng này được GIỮ NGUYÊN, chỉ đơn giản
-- không còn được ứng dụng ghi thêm dữ liệu mới vào roast_batches nữa.

-- ============ product_variants: SKU thành phẩm biết nguyên liệu nguồn ============
-- Một SKU "cà phê rang rời" (coffee_stage = ROASTED) giờ chỉ là "SKU giữ
-- giá/tên bán", KHÔNG có tồn kho riêng — cần biết trừ vào SKU nhân xanh
-- nào khi bán. Cột mới, NULLABLE, tự tham chiếu tới chính bảng này — an
-- toàn tuyệt đối bằng ALTER TABLE ADD COLUMN (không rename, không đụng
-- CHECK nào, giống hệt quyết định an toàn đã dùng cho coffee_stage ở 012).
ALTER TABLE product_variants ADD COLUMN source_green_variant_id TEXT REFERENCES product_variants(id);

-- ============ inventory_transactions: + loại 'SALE' + các cột hóa đơn ============
-- Cần mở rộng CHECK của cột type (+ 'SALE') nên bắt buộc rename+recreate —
-- đã xác nhận lại (giống ghi chú ở migration 012): KHÔNG có bảng nào khác
-- REFERENCES inventory_transactions, nên rename+recreate bảng NÀY hoàn
-- toàn an toàn, dữ liệu cũ được copy nguyên vẹn (các cột mới sẽ NULL cho
-- các dòng cũ).
ALTER TABLE inventory_transactions RENAME TO inventory_transactions_old;
DROP INDEX idx_inventory_transactions_sku;
DROP INDEX idx_inventory_transactions_product_variant_id;
DROP INDEX idx_inventory_transactions_reference;
DROP INDEX idx_inventory_transactions_issue_once;
DROP INDEX idx_inventory_transactions_roast_once;

CREATE TABLE inventory_transactions (
  id TEXT PRIMARY KEY,
  product_variant_id TEXT NOT NULL REFERENCES product_variants(id),
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'RECEIVE', 'ISSUE', 'ADJUSTMENT', 'ROAST_PRODUCTION', 'ROAST_CONSUMPTION', 'SALE'
  )),
  reference_type TEXT,
  reference_id TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Hóa đơn NHẬP (Nhập hàng): nhà cung cấp + số/ngày hóa đơn, đơn giá — chỉ
  -- mang tính tham khảo/lưu vết, không ảnh hưởng công thức tồn kho.
  supplier TEXT,
  invoice_number TEXT,
  invoice_date TEXT,
  unit_price INTEGER,
  -- Bán hàng thành phẩm (type = SALE): product_variant_id/sku/quantity ở
  -- trên LUÔN LÀ SKU NHÂN XANH bị trừ tồn (quantity < 0) — các cột dưới
  -- đây ghi lại SKU thành phẩm thực tế đã bán, KG thành phẩm, khách hàng,
  -- giá bán và VAT để phục vụ hóa đơn/lịch sử, không dùng để tính tồn.
  finished_variant_id TEXT REFERENCES product_variants(id),
  finished_kg REAL,
  customer_id TEXT REFERENCES customers(id),
  line_total INTEGER,
  vat_percent REAL,
  vat_amount INTEGER
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
CREATE UNIQUE INDEX idx_inventory_transactions_roast_once
  ON inventory_transactions(reference_type, reference_id)
  WHERE type = 'ROAST_PRODUCTION';

DROP TABLE inventory_transactions_old;
