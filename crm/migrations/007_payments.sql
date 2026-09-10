-- 007_payments.sql
-- Công nợ: hạn thanh toán trên đơn hàng + lịch sử từng lần thu tiền.
-- Số tiền còn nợ và trạng thái công nợ (chưa/một phần/đã thanh toán/quá hạn)
-- được TÍNH TỪ orders.total_amount - SUM(payments.amount), không lưu cột
-- riêng, để không bao giờ bị lệch dữ liệu.

ALTER TABLE orders ADD COLUMN payment_due_date TEXT;

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  amount INTEGER NOT NULL,
  method TEXT,
  note TEXT,
  paid_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);
