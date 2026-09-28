-- 029_quotation_item_image_specs.sql
-- Ảnh + thông số kỹ thuật cho từng dòng báo giá — cùng cơ chế đã dùng
-- cho order_items/product_variants (ảnh lưu base64 data URL thẳng trong
-- D1, R2 chưa bật). Không có bảng nào REFERENCES quotation_items nên
-- thêm cột trực tiếp an toàn, không cần dựng lại bảng.
ALTER TABLE quotation_items ADD COLUMN image_url TEXT;
ALTER TABLE quotation_items ADD COLUMN specs TEXT;
