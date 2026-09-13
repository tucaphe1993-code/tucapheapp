-- 011_order_deposit_vat.sql
-- "Giá đã bao gồm VAT" — cờ khai báo trên đơn hàng thiết bị, chỉ để hiển
-- thị/in trên chứng từ (không tính toán thuế thực tế). Tiền cọc vẫn dùng
-- đúng bảng payments sẵn có (một dòng payments ghi tại lúc tạo đơn) — công
-- nợ/còn lại vẫn luôn tính từ total_amount - SUM(payments.amount) như cũ.
ALTER TABLE orders ADD COLUMN vat_included INTEGER NOT NULL DEFAULT 0;
