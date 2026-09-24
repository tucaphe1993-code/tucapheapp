-- 026_quick_jobs.sql
-- TÚ QUICK — "Công việc" hẹn nhanh không gắn đơn hàng, vd "Khách A — hẹn
-- ngày mai sửa máy". Khác bảng tasks (việc đóng gói, BẮT BUỘC có đơn) và
-- installations (lắp đặt theo đơn thiết bị). 100% bảng mới, không sửa bảng cũ.

CREATE TABLE quick_jobs (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id),   -- NULL = việc không gắn khách
  title TEXT NOT NULL,                         -- vd "Sửa máy"
  due_date TEXT,                               -- 'YYYY-MM-DD' theo giờ VN, NULL = không hẹn ngày
  note TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DONE', 'CANCELLED')),
  done_at TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_quick_jobs_status_due ON quick_jobs(status, due_date);
CREATE INDEX idx_quick_jobs_customer_id ON quick_jobs(customer_id);
