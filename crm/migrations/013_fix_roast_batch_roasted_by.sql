-- 013_fix_roast_batch_roasted_by.sql
-- Sửa lỗi thiết kế: cột roasted_by ("Người rang") được UI cho nhập TÊN TỰ
-- DO (không bắt buộc là tài khoản trong hệ thống — có thể là thợ rang
-- không có tài khoản đăng nhập), nhưng migration 012 lỡ khai báo
-- REFERENCES users(id), khiến MỌI lần tạo mẻ rang đều lỗi FOREIGN KEY
-- constraint failed ngay khi nhập tên. Bỏ ràng buộc FK này — vẫn giữ
-- nguyên là TEXT tự do, giống hệt cách handover_protocols.contact_name
-- đã làm cho tên người liên hệ không cần là tài khoản hệ thống.
--
-- An toàn: roast_batches là bảng mới hoàn toàn (thêm ở 012), không có
-- bảng nào khác REFERENCES tới nó — rename+recreate không ảnh hưởng gì
-- khác. Dữ liệu cũ (nếu có) được copy nguyên vẹn.
ALTER TABLE roast_batches RENAME TO roast_batches_old;
DROP INDEX idx_roast_batches_green_variant_id;
DROP INDEX idx_roast_batches_roasted_variant_id;
DROP INDEX idx_roast_batches_status;
DROP INDEX idx_roast_batches_created_at;

CREATE TABLE roast_batches (
  id TEXT PRIMARY KEY,
  batch_code TEXT NOT NULL UNIQUE,
  green_variant_id TEXT NOT NULL REFERENCES product_variants(id),
  roasted_variant_id TEXT NOT NULL REFERENCES product_variants(id),
  input_kg REAL NOT NULL CHECK (input_kg > 0),
  shrinkage_percent REAL NOT NULL,
  finished_kg REAL NOT NULL,
  shrinkage_kg REAL NOT NULL,
  green_bean_cost INTEGER NOT NULL DEFAULT 0,
  gas_cost INTEGER NOT NULL DEFAULT 0,
  labor_cost INTEGER NOT NULL DEFAULT 0,
  packaging_cost INTEGER NOT NULL DEFAULT 0,
  other_cost INTEGER NOT NULL DEFAULT 0,
  total_cost INTEGER NOT NULL DEFAULT 0,
  cost_per_kg INTEGER NOT NULL DEFAULT 0,
  labor_hours REAL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CONFIRMED')),
  roasted_by TEXT,
  note TEXT,
  confirmed_at TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO roast_batches
  (id, batch_code, green_variant_id, roasted_variant_id, input_kg, shrinkage_percent, finished_kg,
   shrinkage_kg, green_bean_cost, gas_cost, labor_cost, packaging_cost, other_cost, total_cost,
   cost_per_kg, labor_hours, status, roasted_by, note, confirmed_at, created_by, created_at, updated_at)
SELECT id, batch_code, green_variant_id, roasted_variant_id, input_kg, shrinkage_percent, finished_kg,
       shrinkage_kg, green_bean_cost, gas_cost, labor_cost, packaging_cost, other_cost, total_cost,
       cost_per_kg, labor_hours, status, roasted_by, note, confirmed_at, created_by, created_at, updated_at
FROM roast_batches_old;

CREATE INDEX idx_roast_batches_green_variant_id ON roast_batches(green_variant_id);
CREATE INDEX idx_roast_batches_roasted_variant_id ON roast_batches(roasted_variant_id);
CREATE INDEX idx_roast_batches_status ON roast_batches(status);
CREATE INDEX idx_roast_batches_created_at ON roast_batches(created_at);

DROP TABLE roast_batches_old;
