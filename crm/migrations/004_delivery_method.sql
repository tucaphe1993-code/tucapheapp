-- 004_delivery_method.sql
-- Cách thức giao hàng (Khách đến lấy / Gửi xe khách / Book Ship / ...).
-- Free-text (not an enum CHECK) so new shipping partners can be added from
-- the UI without another migration.

ALTER TABLE orders ADD COLUMN delivery_method TEXT;
