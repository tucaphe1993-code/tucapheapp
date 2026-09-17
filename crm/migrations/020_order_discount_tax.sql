-- Diễn giải riêng cho đơn bán (khác Ghi chú) + chiết khấu/thuế theo dòng
-- hàng hóa (§ Tạo đơn bán hàng — giống ERP tham khảo). Đơn giá vẫn LUÔN
-- lấy từ CSDL (không đổi), CK%/Thuế% chỉ áp thêm lên trên giá đó.
ALTER TABLE orders ADD COLUMN description TEXT;
ALTER TABLE order_items ADD COLUMN discount_percent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN tax_percent INTEGER NOT NULL DEFAULT 0;
