-- 015_reset_business_data.sql
-- XÓA DỮ LIỆU NGHIỆP VỤ THẬT theo yêu cầu tường minh của chủ doanh nghiệp
-- (đã xác nhận rõ ràng bằng số liệu cụ thể trước khi chạy: 10 khách hàng,
-- 34 đơn hàng, 11 thanh toán, 4 giao dịch kho tại thời điểm xác nhận) để
-- "làm lại từ đầu" theo mô hình ERP mới (Bán hàng/Mua hàng/Kho/Thu-Chi/
-- Công nợ). Đây là hành động xóa dữ liệu DUY NHẤT trong toàn bộ lịch sử
-- migration được phép làm — vì có xác nhận trực tiếp từ chủ doanh nghiệp,
-- khác với quy tắc mặc định "KHÔNG được tự ý xóa dữ liệu".
--
-- KHÔNG xóa: users (tài khoản nhân viên), products/product_variants/
-- inventory (tồn kho hiện tại giữ nguyên làm số dư đầu kỳ cho hệ thống
-- mới), devices (máy/thiết bị vật lý vẫn còn thật, chỉ gỡ tham chiếu tới
-- đơn hàng/khách hàng đã xóa), audit_logs (nhật ký thao tác hệ thống).
--
-- Thứ tự xóa tuân theo chiều phụ thuộc khóa ngoại (xóa con trước cha).

DELETE FROM report_images;
DELETE FROM reports;
DELETE FROM task_checklists;
DELETE FROM tasks;

DELETE FROM handover_protocol_checklist;
DELETE FROM handover_protocol_devices;
DELETE FROM handover_protocol_accessories;
DELETE FROM handover_protocols;

DELETE FROM installation_checklists;
DELETE FROM installations;

DELETE FROM payments;
DELETE FROM customer_prices;

-- Gỡ tham chiếu tới đơn hàng/khách hàng/dòng sản phẩm sắp xóa trên máy/
-- thiết bị vật lý — KHÔNG xóa devices/device_history, chỉ null hóa các
-- cột tham chiếu (order_item_id cũng phải gỡ, không thì DELETE order_items
-- bên dưới sẽ lỗi FOREIGN KEY).
UPDATE devices SET order_id = NULL, order_item_id = NULL, customer_id = NULL;
UPDATE device_history SET order_id = NULL, customer_id = NULL;

-- inventory_transactions.customer_id cũng REFERENCES customers(id) (dù
-- nullable) — phải xóa TRƯỚC khi xóa customers, không thì lỗi FK.
DELETE FROM inventory_transactions;
DELETE FROM notifications;

DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM customers;

-- Reset bộ đếm mã tự sinh về lại từ đầu (DH-0001, BB-0001...).
UPDATE order_sequence SET next_value = 1 WHERE id = 1;
UPDATE protocol_sequence SET next_value = 1 WHERE id = 1;
