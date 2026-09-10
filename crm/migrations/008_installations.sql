-- 008_installations.sql
-- Job lắp đặt thiết bị (máy pha, máy xay...) liên kết với đơn hàng + khách
-- hàng, có checklist riêng (kiểu tương tự task đóng gói) và lưu vĩnh viễn
-- để tra cứu bảo hành/bảo trì sau này theo serial number.

CREATE TABLE installations (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  equipment TEXT NOT NULL,
  serial_number TEXT,
  location TEXT,
  scheduled_at TEXT,
  technician_id TEXT REFERENCES users(id),
  assigned_by TEXT REFERENCES users(id),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','SCHEDULED','IN_PROGRESS','COMPLETED','HANDED_OVER','CANCELLED')),
  started_at TEXT,
  completed_at TEXT,
  handed_over_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_installations_order_id ON installations(order_id);
CREATE INDEX idx_installations_customer_id ON installations(customer_id);
CREATE INDEX idx_installations_technician_id ON installations(technician_id);
CREATE INDEX idx_installations_serial_number ON installations(serial_number);

CREATE TABLE installation_checklists (
  id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES installations(id),
  label TEXT NOT NULL,
  is_required INTEGER NOT NULL DEFAULT 1,
  is_checked INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_installation_checklists_installation_id ON installation_checklists(installation_id);
