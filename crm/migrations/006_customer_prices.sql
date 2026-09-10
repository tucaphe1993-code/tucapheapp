-- 006_customer_prices.sql
-- Giá bán sỉ riêng cho từng khách hàng, theo từng SKU. Khi tạo đơn cho một
-- khách hàng có giá riêng cho SKU đó, hệ thống dùng giá này thay cho
-- product_variants.unit_price mặc định.

CREATE TABLE customer_prices (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  product_variant_id TEXT NOT NULL REFERENCES product_variants(id),
  unit_price INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (customer_id, product_variant_id)
);

CREATE INDEX idx_customer_prices_customer_id ON customer_prices(customer_id);
