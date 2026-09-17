-- 017_customer_code.sql
-- Thêm mã khách hàng tự sinh (KH000, KH001...) — đối xứng với mã nhà cung
-- cấp (NCC000...) đã có ở migration 016, để chọn khách hàng bằng dropdown
-- danh sách đầy đủ (kiểu "KH000 - Khách lẻ") thay vì phải gõ tìm.
--
-- Cột mới NULLABLE — an toàn bằng ALTER TABLE ADD COLUMN. Khách hàng cũ
-- (nếu có) sẽ có code NULL, không sao vì không có khách hàng nào tồn tại
-- ở thời điểm này (đã xác nhận xóa sạch dữ liệu cũ ở migration 015);
-- khách hàng tạo mới trở đi luôn được sinh code.
ALTER TABLE customers ADD COLUMN code TEXT;
CREATE UNIQUE INDEX idx_customers_code ON customers(code) WHERE code IS NOT NULL;

CREATE TABLE customer_sequence (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_value INTEGER NOT NULL
);
INSERT INTO customer_sequence (id, next_value) VALUES (1, 0);
