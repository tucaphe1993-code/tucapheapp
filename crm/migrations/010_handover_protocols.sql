-- 010_handover_protocols.sql
-- Biên bản Lắp đặt – Bàn giao – Kích hoạt bảo hành. Sinh tự động từ đơn
-- hàng + hồ sơ khách hàng + thiết bị đã bán (không nhập lại thủ công).
-- 100% bảng mới — không đụng tới schema hiện tại.

CREATE TABLE handover_protocols (
  id TEXT PRIMARY KEY,
  protocol_code TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL REFERENCES orders(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL DEFAULT 'PENDING_INSTALL' CHECK (status IN (
    'PENDING_INSTALL', 'INSTALLING', 'PENDING_CONFIRMATION', 'HANDED_OVER',
    'WARRANTY_ACTIVATED', 'COMPLETED'
  )),
  contact_name TEXT,
  contact_phone TEXT,
  install_address TEXT,
  note TEXT,
  technician_id TEXT REFERENCES users(id),
  installed_at TEXT,
  device_condition TEXT,
  exception_note TEXT,
  handed_over_at TEXT,
  warranty_activated_at TEXT,
  warranty_activated_by TEXT REFERENCES users(id),
  signature_a_data TEXT,
  signature_a_name TEXT,
  signature_a_signed_at TEXT,
  signature_b_data TEXT,
  signature_b_name TEXT,
  signature_b_signed_at TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_handover_protocols_order_id ON handover_protocols(order_id);
CREATE INDEX idx_handover_protocols_customer_id ON handover_protocols(customer_id);
CREATE INDEX idx_handover_protocols_status ON handover_protocols(status);

-- Snapshot of every device covered by this protocol (a protocol can cover
-- every device sold in the order, e.g. 1x LAMVITA GO + 1x LAMVITA MX).
CREATE TABLE handover_protocol_devices (
  id TEXT PRIMARY KEY,
  protocol_id TEXT NOT NULL REFERENCES handover_protocols(id),
  device_id TEXT REFERENCES devices(id),
  product_name TEXT NOT NULL,
  model TEXT,
  serial_number TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  condition TEXT DEFAULT 'Mới',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_handover_protocol_devices_protocol_id ON handover_protocol_devices(protocol_id);

-- Accessories handed over alongside the devices (auto-filled from the
-- order's non-serialized line items; can also be added manually).
CREATE TABLE handover_protocol_accessories (
  id TEXT PRIMARY KEY,
  protocol_id TEXT NOT NULL REFERENCES handover_protocols(id),
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_handover_protocol_accessories_protocol_id ON handover_protocol_accessories(protocol_id);

-- Two fixed checklists (category INSTALL / GUIDE) generated when the
-- protocol is created.
CREATE TABLE handover_protocol_checklist (
  id TEXT PRIMARY KEY,
  protocol_id TEXT NOT NULL REFERENCES handover_protocols(id),
  category TEXT NOT NULL CHECK (category IN ('INSTALL', 'GUIDE')),
  label TEXT NOT NULL,
  is_checked INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  checked_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_handover_protocol_checklist_protocol_id ON handover_protocol_checklist(protocol_id);

-- Sequential "Số biên bản" (BB-0001, BB-0002, ...), same pattern as
-- order_sequence for DH-xxxx codes.
CREATE TABLE protocol_sequence (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_value INTEGER NOT NULL
);
INSERT INTO protocol_sequence (id, next_value) VALUES (1, 1);
