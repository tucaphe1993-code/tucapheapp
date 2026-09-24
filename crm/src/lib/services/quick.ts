// TÚ QUICK — truy vấn dữ liệu CRM cho màn hình ghi đơn nhanh (/quick).
// Chỉ ĐỌC. Tạo đơn/khách/thanh toán vẫn đi qua đúng các API CRM có sẵn
// (POST /api/orders, /api/customers, /api/orders/[id]/ship|complete).

import type { OrderStatus } from "@/types/db";
import type { QuickVariant } from "@/lib/quick";

export interface QuickOrderItem {
  product_name: string;
  weight_grams: number | null;
  quantity: number;
}

export interface QuickOrder {
  id: string;
  order_code: string;
  customer_name: string;
  delivery_date: string | null;
  status: OrderStatus;
  total_amount: number;
  paid_amount: number;
  created_at: string;
  items: QuickOrderItem[];
}

export interface QuickHomeData {
  orders: QuickOrder[];
  receivable: number;
  customerCount: number;
}

// Đơn còn mở (mọi lúc) + đơn gần đây (35 ngày) — đủ cho các bộ lọc mà
// không tải toàn bộ lịch sử lên điện thoại.
const RECENT_ORDERS_WHERE = `
  o.status != 'DRAFT' AND (
    o.status NOT IN ('COMPLETED', 'CANCELLED')
    OR o.created_at >= datetime('now', '-35 days')
    OR o.delivery_date >= date('now', '-35 days')
  )`;

export async function loadQuickHome(db: D1Database): Promise<QuickHomeData> {
  const [ordersRes, itemsRes, receivableRow, customerRow] = await Promise.all([
    db
      .prepare(
        `SELECT o.id, o.order_code, c.name AS customer_name, o.delivery_date, o.status,
                o.total_amount, o.created_at,
                COALESCE((SELECT SUM(amount) FROM payments p WHERE p.order_id = o.id), 0) AS paid_amount
         FROM orders o JOIN customers c ON c.id = o.customer_id
         WHERE ${RECENT_ORDERS_WHERE}
         ORDER BY o.created_at DESC LIMIT 300`
      )
      .all<Omit<QuickOrder, "items">>(),
    db
      .prepare(
        `SELECT oi.order_id, oi.product_name, oi.weight_grams, oi.quantity
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE ${RECENT_ORDERS_WHERE}`
      )
      .all<QuickOrderItem & { order_id: string }>(),
    // Cùng công thức trang Công nợ: tổng đơn (trừ đơn hủy) - tổng đã trả.
    db
      .prepare(
        `SELECT COALESCE(SUM(MAX(o.total_amount - COALESCE((SELECT SUM(amount) FROM payments p WHERE p.order_id = o.id), 0), 0)), 0) AS remaining
         FROM orders o WHERE o.status != 'CANCELLED'`
      )
      .first<{ remaining: number }>(),
    db.prepare(`SELECT COUNT(*) AS c FROM customers WHERE is_deleted = 0`).first<{ c: number }>(),
  ]);

  const itemsByOrder = new Map<string, QuickOrderItem[]>();
  for (const { order_id, ...item } of itemsRes.results) {
    const list = itemsByOrder.get(order_id) ?? [];
    list.push(item);
    itemsByOrder.set(order_id, list);
  }

  return {
    orders: ordersRes.results.map((o) => ({ ...o, items: itemsByOrder.get(o.id) ?? [] })),
    receivable: receivableRow?.remaining ?? 0,
    customerCount: customerRow?.c ?? 0,
  };
}

// ===== DỮ LIỆU CHO FORM GHI ĐƠN =====

export interface QuickCustomer {
  id: string;
  code: string | null;
  name: string;
  phone: string | null;
  last_order_at: string | null;
}

export interface QuickProduct {
  id: string;
  name: string;
  variants: QuickVariant[];
  /** Quy cách được đặt nhiều nhất (mặc định khi khách chưa từng mua). */
  most_ordered_variant_id: string | null;
}

export interface QuickFormData {
  customers: QuickCustomer[];
  products: QuickProduct[];
  /** customer_id → product_id → quy cách khách mua gần nhất. */
  lastVariants: Record<string, Record<string, string>>;
}

export async function loadQuickFormData(db: D1Database): Promise<QuickFormData> {
  const [customersRes, productsRes, variantsRes, lastRes, popularRes] = await Promise.all([
    db
      .prepare(
        `SELECT c.id, c.code, c.name, c.phone,
                (SELECT MAX(created_at) FROM orders o WHERE o.customer_id = c.id) AS last_order_at
         FROM customers c WHERE c.is_deleted = 0`
      )
      .all<QuickCustomer>(),
    // Ghi đơn nhanh = cà phê thành phẩm đóng gói. Thiết bị cần chọn Serial,
    // nhân xanh/rang rời là nguyên liệu → vẫn tạo ở màn Tạo đơn của CRM.
    db
      .prepare(
        `SELECT id, name FROM products
         WHERE product_type = 'COFFEE' AND coffee_stage IS NULL AND is_active = 1
         ORDER BY name`
      )
      .all<{ id: string; name: string }>(),
    db
      .prepare(
        `SELECT pv.id, pv.product_id, pv.form, pv.packaging, pv.weight_grams, pv.unit, pv.unit_price
         FROM product_variants pv JOIN products p ON p.id = pv.product_id
         WHERE pv.is_active = 1 AND pv.requires_serial = 0
           AND p.product_type = 'COFFEE' AND p.coffee_stage IS NULL AND p.is_active = 1
         ORDER BY pv.weight_grams DESC`
      )
      .all<QuickVariant>(),
    // SQLite: cột thường đi cùng MAX() lấy đúng dòng có giá trị lớn nhất.
    db
      .prepare(
        `SELECT o.customer_id, pv.product_id, oi.product_variant_id, MAX(o.created_at) AS at
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         JOIN product_variants pv ON pv.id = oi.product_variant_id
         WHERE o.status != 'CANCELLED'
         GROUP BY o.customer_id, pv.product_id`
      )
      .all<{ customer_id: string; product_id: string; product_variant_id: string }>(),
    db
      .prepare(
        `SELECT pv.product_id, oi.product_variant_id, COUNT(*) AS n
         FROM order_items oi JOIN product_variants pv ON pv.id = oi.product_variant_id
         GROUP BY oi.product_variant_id ORDER BY n DESC`
      )
      .all<{ product_id: string; product_variant_id: string }>(),
  ]);

  const mostOrdered = new Map<string, string>();
  for (const r of popularRes.results) if (!mostOrdered.has(r.product_id)) mostOrdered.set(r.product_id, r.product_variant_id);

  const lastVariants: QuickFormData["lastVariants"] = {};
  for (const r of lastRes.results) {
    (lastVariants[r.customer_id] ??= {})[r.product_id] = r.product_variant_id;
  }

  return {
    customers: customersRes.results,
    products: productsRes.results
      .map((p) => ({
        ...p,
        variants: variantsRes.results.filter((v) => v.product_id === p.id),
        most_ordered_variant_id: mostOrdered.get(p.id) ?? null,
      }))
      .filter((p) => p.variants.length > 0),
    lastVariants,
  };
}
