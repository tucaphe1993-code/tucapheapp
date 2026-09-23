-- 025_quotation_reference_items.sql
-- Dòng báo giá "chỉ để tham khảo": hiển thị tên sản phẩm + đơn giá cho
-- khách biết giá từng loại, nhưng KHÔNG cộng vào Tạm tính/Tổng cộng và
-- không hiện "Thành tiền" — dùng khi liệt kê bảng giá tham khảo kèm theo
-- báo giá, không phải đang chào bán loại đó trong đơn này.

ALTER TABLE quotation_items ADD COLUMN is_reference INTEGER NOT NULL DEFAULT 0;
