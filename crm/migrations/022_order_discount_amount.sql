-- Giảm giá cấp đơn (§ Tạo đơn bán hàng) — số tiền cố định trừ thẳng vào
-- tổng tiền đơn, tách biệt với CK% từng dòng hàng đã có (migration 020).
ALTER TABLE orders ADD COLUMN discount_amount INTEGER NOT NULL DEFAULT 0;
