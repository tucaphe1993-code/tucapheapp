-- Thuế VAT trên đơn mua (§ Tạo đơn mua hàng) — nhập % VAT, hệ thống tự cộng
-- vào tổng tiền. vat_amount lưu lại số tiền thuế đã tính tại thời điểm tạo
-- đơn (không suy ra lại từ % vì % có thể đổi mặc định về sau).
ALTER TABLE purchase_orders ADD COLUMN vat_percent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN vat_amount INTEGER NOT NULL DEFAULT 0;
