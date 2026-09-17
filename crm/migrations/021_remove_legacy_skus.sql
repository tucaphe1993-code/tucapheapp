-- Xóa hẳn 5 SKU theo yêu cầu tường minh của người dùng (đã xác nhận sau
-- khi xem đúng số liệu ảnh hưởng thật): LAMVITAGO, CRM3200, LVT,
-- ROBUSTACLEAN, RCR-CLEAN.
--  - LVT: xóa dòng hàng khỏi đơn DH-0001 (Đã xác nhận, 19.440.000đ)
--  - CRM3200: xóa dòng hàng khỏi 3 đơn mua NCC (MH-0001/002/003)
--  - LAMVITAGO: xóa 1 thiết bị/Serial gắn SKU này
--  - ROBUSTACLEAN + RCR-CLEAN: xóa 1 mẻ rang (roast_batches) nối 2 SKU
-- Sau khi xóa dòng hàng, tính lại total_amount của đơn/đơn mua bị ảnh
-- hưởng theo đúng số hàng còn lại — không để lại tổng tiền sai lệch.

-- 1. Gỡ liên kết tới devices trước khi xóa devices.
UPDATE handover_protocol_devices SET device_id = NULL
  WHERE device_id IN (
    SELECT id FROM devices WHERE product_variant_id IN (
      SELECT id FROM product_variants WHERE sku IN ('LAMVITAGO','CRM3200','LVT','ROBUSTACLEAN','RCR-CLEAN')
    )
  );

UPDATE installations SET device_id = NULL
  WHERE device_id IN (
    SELECT id FROM devices WHERE product_variant_id IN (
      SELECT id FROM product_variants WHERE sku IN ('LAMVITAGO','CRM3200','LVT','ROBUSTACLEAN','RCR-CLEAN')
    )
  );

DELETE FROM device_history
  WHERE device_id IN (
    SELECT id FROM devices WHERE product_variant_id IN (
      SELECT id FROM product_variants WHERE sku IN ('LAMVITAGO','CRM3200','LVT','ROBUSTACLEAN','RCR-CLEAN')
    )
  );

-- 2. Gỡ devices.order_item_id trỏ tới order_items sắp xóa.
UPDATE devices SET order_item_id = NULL
  WHERE order_item_id IN (
    SELECT id FROM order_items WHERE product_variant_id IN (
      SELECT id FROM product_variants WHERE sku IN ('LAMVITAGO','CRM3200','LVT','ROBUSTACLEAN','RCR-CLEAN')
    )
  );

-- 3. Xóa devices, order_items, purchase_order_items, roast_batches.
DELETE FROM devices
  WHERE product_variant_id IN (
    SELECT id FROM product_variants WHERE sku IN ('LAMVITAGO','CRM3200','LVT','ROBUSTACLEAN','RCR-CLEAN')
  );

DELETE FROM order_items
  WHERE product_variant_id IN (
    SELECT id FROM product_variants WHERE sku IN ('LAMVITAGO','CRM3200','LVT','ROBUSTACLEAN','RCR-CLEAN')
  );

DELETE FROM purchase_order_items
  WHERE product_variant_id IN (
    SELECT id FROM product_variants WHERE sku IN ('LAMVITAGO','CRM3200','LVT','ROBUSTACLEAN','RCR-CLEAN')
  );

DELETE FROM roast_batches
  WHERE green_variant_id IN (SELECT id FROM product_variants WHERE sku IN ('LAMVITAGO','CRM3200','LVT','ROBUSTACLEAN','RCR-CLEAN'))
     OR roasted_variant_id IN (SELECT id FROM product_variants WHERE sku IN ('LAMVITAGO','CRM3200','LVT','ROBUSTACLEAN','RCR-CLEAN'));

-- 4. Xóa các bảng "lá" còn lại tham chiếu tới SKU.
DELETE FROM customer_prices
  WHERE product_variant_id IN (
    SELECT id FROM product_variants WHERE sku IN ('LAMVITAGO','CRM3200','LVT','ROBUSTACLEAN','RCR-CLEAN')
  );

DELETE FROM inventory_transactions
  WHERE product_variant_id IN (
    SELECT id FROM product_variants WHERE sku IN ('LAMVITAGO','CRM3200','LVT','ROBUSTACLEAN','RCR-CLEAN')
  );

DELETE FROM inventory
  WHERE product_variant_id IN (
    SELECT id FROM product_variants WHERE sku IN ('LAMVITAGO','CRM3200','LVT','ROBUSTACLEAN','RCR-CLEAN')
  );

UPDATE product_variants SET source_green_variant_id = NULL
  WHERE source_green_variant_id IN (
    SELECT id FROM product_variants WHERE sku IN ('LAMVITAGO','CRM3200','LVT','ROBUSTACLEAN','RCR-CLEAN')
  );

-- 5. Xóa chính 5 SKU.
DELETE FROM product_variants WHERE sku IN ('LAMVITAGO','CRM3200','LVT','ROBUSTACLEAN','RCR-CLEAN');

-- 6. Tính lại tổng tiền đơn/đơn mua bị ảnh hưởng theo đúng số hàng còn lại.
UPDATE orders SET
  total_amount = (SELECT COALESCE(SUM(line_total), 0) FROM order_items WHERE order_id = orders.id),
  updated_at = datetime('now')
WHERE order_code = 'DH-0001';

UPDATE purchase_orders SET
  vat_amount = CAST(ROUND(
    (SELECT COALESCE(SUM(line_total), 0) FROM purchase_order_items WHERE purchase_order_id = purchase_orders.id) * vat_percent / 100.0
  ) AS INTEGER),
  total_amount = (SELECT COALESCE(SUM(line_total), 0) FROM purchase_order_items WHERE purchase_order_id = purchase_orders.id)
    + CAST(ROUND(
        (SELECT COALESCE(SUM(line_total), 0) FROM purchase_order_items WHERE purchase_order_id = purchase_orders.id) * vat_percent / 100.0
      ) AS INTEGER),
  updated_at = datetime('now')
WHERE po_code IN ('MH-0001', 'MH-0002', 'MH-0003');
