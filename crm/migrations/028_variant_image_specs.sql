-- 028_variant_image_specs.sql
-- Ảnh + thông số kỹ thuật cho từng SKU/dòng "Đơn hàng tự do" — lưu ảnh
-- dạng base64 data URL thẳng trong D1 (R2 chưa bật cho deployment này,
-- cùng lý do đã áp dụng cho report_images/chữ ký biên bản), giới hạn
-- kích thước ở tầng ứng dụng (xem lib/services/products.ts).
ALTER TABLE product_variants ADD COLUMN image_url TEXT;
ALTER TABLE product_variants ADD COLUMN specs TEXT;
