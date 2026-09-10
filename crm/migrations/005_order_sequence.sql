-- 005_order_sequence.sql
-- Simple, readable sequential order codes (DH-0001, DH-0002, ...) instead
-- of the date+random suffix, which customers/staff found hard to read.
-- A dedicated single-row counter table + atomic UPDATE...RETURNING avoids
-- race conditions between concurrent order creations.

CREATE TABLE order_sequence (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_value INTEGER NOT NULL
);

-- Start after however many orders already exist so existing order codes
-- and the new sequential ones don't collide in spirit (old codes are left
-- as-is; only new orders get the new DH-#### format).
INSERT INTO order_sequence (id, next_value)
  SELECT 1, COALESCE((SELECT COUNT(*) FROM orders), 0) + 1;
