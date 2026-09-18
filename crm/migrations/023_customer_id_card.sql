-- 023_customer_id_card.sql
-- Lưu số CCCD khách hàng — khách gọi bảo hành thường chỉ nhớ mã phiếu
-- hoặc CCCD chứ không nhớ mã KH, cần tra được theo cả 2.
ALTER TABLE customers ADD COLUMN id_card_number TEXT;
