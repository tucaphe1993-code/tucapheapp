// =====================================================================
// CLOUDFLARE WORKER — backend dùng chung cho Sản phẩm/Tồn kho + Đơn hàng,
// lưu trong Cloudflare D1 (SQLite). Đây là nơi DUY NHẤT được phép ghi vào
// D1 — mọi thiết bị (trang bán hàng, khu quản trị của mọi nhân viên) đều
// đọc/ghi qua các endpoint dưới đây, để tất cả cùng thấy 1 nguồn dữ liệu.
//
// ⚠️ CHƯA ĐƯỢC DEPLOY. Xem worker/README.md để biết cách tạo D1, chạy
// worker/schema.sql + worker/seed.sql, và deploy bằng wrangler.
//
// Nguyên liệu/Công thức/Combo/Danh mục/Nhân sự/Tài chính KHÔNG đi qua Worker
// này — vẫn lưu localStorage riêng từng máy (ngoài phạm vi đợt đồng bộ này).
//
// Xác thực: chỉ có 1 "X-Admin-Token" dùng chung cho mọi nhân viên (đặt qua
// `wrangler secret put ADMIN_TOKEN`) — KHÔNG phải tài khoản riêng từng người,
// KHÔNG phải bảo mật production thật, chỉ đủ để chặn người lạ trên Internet
// ghi thẳng vào D1. Endpoint đọc/tạo sản phẩm công khai (khách cần xem giá)
// vẫn public; mọi endpoint sửa/xoá dữ liệu đều cần token này.
// =====================================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = buildCorsHeaders();
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      const { body, status } = await route(request, url, env);
      return jsonResponse(body, status || 200, corsHeaders);
    } catch (err) {
      return jsonResponse({ error: err.message || "Lỗi máy chủ" }, err.status || 500, corsHeaders);
    }
  },
};

function buildCorsHeaders() {
  const allowedOrigin = "https://order.tucaphe.vn"; // TODO: xác nhận lại domain bán hàng thật sẽ dùng
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
  };
}
function jsonResponse(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}
function fail(message, status) {
  const e = new Error(message);
  e.status = status;
  throw e;
}
async function readJson(request) {
  try {
    return await request.json();
  } catch {
    fail("Body không hợp lệ (không đọc được JSON).", 400);
  }
}
function requireAdmin(request, env) {
  const token = request.headers.get("X-Admin-Token");
  if (!token || token !== env.ADMIN_TOKEN) fail("Không có quyền truy cập (thiếu/sai X-Admin-Token).", 401);
}

// ===== ROUTER =====
async function route(request, url, env) {
  const { pathname } = url;
  const method = request.method;

  if (pathname === "/api/products" && method === "GET") {
    return { body: await listProducts(env) };
  }
  if (pathname === "/api/products" && method === "POST") {
    requireAdmin(request, env);
    return { body: await createProduct(env, await readJson(request)), status: 201 };
  }
  const productStockMatch = pathname.match(/^\/api\/products\/([^/]+)\/stock$/);
  if (productStockMatch && method === "PATCH") {
    requireAdmin(request, env);
    return { body: await adjustProductStock(env, productStockMatch[1], await readJson(request)) };
  }
  const productIdMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
  if (productIdMatch && method === "PATCH") {
    requireAdmin(request, env);
    return { body: await updateProduct(env, productIdMatch[1], await readJson(request)) };
  }

  if (pathname === "/api/stock-tx" && method === "GET") {
    requireAdmin(request, env);
    return { body: await listStockTx(env) };
  }
  const stockTxIdMatch = pathname.match(/^\/api\/stock-tx\/([^/]+)$/);
  if (stockTxIdMatch && method === "DELETE") {
    requireAdmin(request, env);
    return { body: await deleteStockTx(env, stockTxIdMatch[1]) };
  }

  if (pathname === "/api/orders" && method === "GET") {
    requireAdmin(request, env);
    return { body: await listOrders(env) };
  }
  if (pathname === "/api/orders" && method === "POST") {
    return { body: await createOrder(env, await readJson(request)), status: 201 };
  }
  const orderIdMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (orderIdMatch && method === "PATCH") {
    requireAdmin(request, env);
    return { body: await updateOrder(env, orderIdMatch[1], await readJson(request)) };
  }

  fail("Not found", 404);
}

// ===== HELPERS DÙNG CHUNG =====
function slugify(name) {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") + "-" + Date.now().toString().slice(-4)
  );
}
// Bộ đếm tuần tự dùng chung cho mã đơn (TCP-xxxxxx) và mã phiếu kho
// (PN/PX-xxxxxx) — UPDATE...RETURNING atomic ở D1, tránh 2 request cùng lúc
// sinh trùng số.
async function nextSeq(env, name) {
  const row = await env.DB.prepare("UPDATE counters SET value = value + 1 WHERE name = ? RETURNING value").bind(name).first();
  return row.value;
}
async function nextOrderId(env) {
  const seq = await nextSeq(env, "order_seq");
  return "TCP-" + String(seq).padStart(6, "0");
}
async function nextStockTxId(env, type) {
  const seq = await nextSeq(env, "stock_tx_seq");
  return (type === "nhap" ? "PN-" : "PX-") + String(seq).padStart(6, "0");
}

// Quy tắc giá sỉ/lẻ — PHẢI khớp đúng js/pricing.js (getUnitPrice/isWholesaleApplied)
// vì đây là bản sao chạy phía server để tính lại giá, không tin số liệu client gửi.
function getUnitPrice(product, cartTotalKg) {
  if (product.category_id !== "ca-phe") return product.retail_price;
  return cartTotalKg >= product.wholesale_min_kg ? product.wholesale_price : product.retail_price;
}
function isWholesaleApplied(product, cartTotalKg) {
  if (product.category_id !== "ca-phe") return false;
  return cartTotalKg >= product.wholesale_min_kg;
}

function rowToProduct(row) {
  return {
    id: row.id, category_id: row.category_id, name: row.name, unit: row.unit,
    icon: row.icon || "", image: row.image || "", short_desc: row.short_desc || "",
    description: row.description || "", specs: row.specs ? JSON.parse(row.specs) : undefined,
    variants: row.variants ? JSON.parse(row.variants) : undefined,
    retail_price: row.retail_price, wholesale_price: row.wholesale_price,
    wholesale_min_kg: row.wholesale_min_kg, stock: row.stock, badge: row.badge || null,
    visible: !!row.visible,
  };
}

// ===== SẢN PHẨM =====
async function listProducts(env) {
  const { results } = await env.DB.prepare("SELECT * FROM products").all();
  return results.map(rowToProduct);
}

const PRODUCT_EDITABLE_FIELDS = [
  "category_id", "name", "unit", "icon", "image", "short_desc", "description",
  "specs", "variants", "retail_price", "wholesale_price", "wholesale_min_kg", "badge", "visible",
]; // KHÔNG có "stock" — chỉ đổi qua PATCH /api/products/:id/stock.

async function updateProduct(env, id, fields) {
  const sets = [];
  const values = [];
  for (const key of PRODUCT_EDITABLE_FIELDS) {
    if (!(key in fields)) continue;
    sets.push(`${key} = ?`);
    if (key === "specs" || key === "variants") values.push(fields[key] ? JSON.stringify(fields[key]) : null);
    else if (key === "visible") values.push(fields.visible ? 1 : 0);
    else values.push(fields[key]);
  }
  if (!sets.length) fail("Không có field hợp lệ để cập nhật.", 400);
  values.push(id);
  await env.DB.prepare(`UPDATE products SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
  const row = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();
  if (!row) fail("Không tìm thấy sản phẩm.", 404);
  return rowToProduct(row);
}

async function createProduct(env, data) {
  if (!data || !data.name) fail("Thiếu tên sản phẩm.", 400);
  const id = slugify(data.name);
  await env.DB.prepare(
    `INSERT INTO products (id, category_id, name, unit, icon, image, short_desc, description, specs, variants, retail_price, wholesale_price, wholesale_min_kg, stock, badge, visible)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      id, data.category_id || "", data.name, data.unit || "kg",
      data.icon || "☕", data.image || null, data.short_desc || "", data.description || "",
      data.specs ? JSON.stringify(data.specs) : null, data.variants ? JSON.stringify(data.variants) : null,
      Number(data.retail_price) || 0, Number(data.wholesale_price) || 0, Number(data.wholesale_min_kg) || 1,
      Number(data.stock) || 0, data.badge || null, data.visible === false ? 0 : 1
    )
    .run();
  const row = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();
  return rowToProduct(row);
}

// Endpoint DUY NHẤT được đổi stock — dùng cho phiếu kho thủ công + mẻ sản
// xuất (nhập thành phẩm) trong khu quản trị. body: { delta, type, note,
// source, ref_id, date }. delta dương = nhập, âm = xuất.
async function adjustProductStock(env, id, meta) {
  const delta = Number(meta.delta);
  if (!Number.isFinite(delta) || delta === 0) fail("delta không hợp lệ.", 400);

  const product = await env.DB.prepare("SELECT name, unit FROM products WHERE id = ?").bind(id).first();
  if (!product) fail("Không tìm thấy sản phẩm.", 404);

  const updated = await env.DB.prepare("UPDATE products SET stock = MAX(0, stock + ?) WHERE id = ? RETURNING stock")
    .bind(delta, id)
    .first();

  const txId = await nextStockTxId(env, meta.type === "nhap" ? "nhap" : "xuat");
  await env.DB.prepare(
    `INSERT INTO stock_tx (id, type, item_type, item_id, item_name, unit, qty, date, note, source, ref_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      txId, meta.type === "nhap" ? "nhap" : "xuat", "product", id, product.name, product.unit,
      Math.abs(delta), meta.date || new Date().toISOString(), meta.note || "", meta.source || "manual", meta.ref_id || null
    )
    .run();

  return { stock: updated.stock, txId };
}

// ===== SỔ XUẤT NHẬP TỒN =====
async function listStockTx(env) {
  const { results } = await env.DB.prepare("SELECT * FROM stock_tx ORDER BY date DESC").all();
  return results;
}

async function deleteStockTx(env, id) {
  const tx = await env.DB.prepare("SELECT * FROM stock_tx WHERE id = ?").bind(id).first();
  if (!tx) fail("Không tìm thấy phiếu.", 404);
  if (tx.source !== "manual") fail("Chỉ được xoá phiếu tạo thủ công.", 400);

  const revertDelta = tx.type === "nhap" ? -tx.qty : tx.qty;
  await env.DB.prepare("UPDATE products SET stock = MAX(0, stock + ?) WHERE id = ?").bind(revertDelta, tx.item_id).run();
  await env.DB.prepare("DELETE FROM stock_tx WHERE id = ?").bind(id).run();
  return { ok: true };
}

// ===== ĐƠN HÀNG =====
async function listOrders(env) {
  const { results: orders } = await env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  const { results: items } = await env.DB.prepare("SELECT * FROM order_items").all();
  const itemsByOrder = new Map();
  for (const it of items) {
    if (!itemsByOrder.has(it.order_id)) itemsByOrder.set(it.order_id, []);
    itemsByOrder.get(it.order_id).push({
      productId: it.product_id, name: it.name, unit: it.unit, qty: it.qty,
      unitPrice: it.unit_price, lineTotal: it.line_total, priceType: it.price_type,
    });
  }
  return orders.map((o) => ({
    id: o.id, createdAt: o.created_at, customerName: o.customer_name, customerPhone: o.customer_phone,
    customerCompany: o.customer_company, address: o.address, province: o.province, note: o.note,
    totalKg: o.total_kg, total: o.total, status: o.status, delivery_status: o.delivery_status,
    delivery_date_planned: o.delivery_date_planned, delivery_date_actual: o.delivery_date_actual,
    shipper_name: o.shipper_name, channel: o.channel,
    lines: itemsByOrder.get(o.id) || [],
  }));
}

const ORDER_EDITABLE_FIELDS = ["status", "delivery_status", "delivery_date_planned", "delivery_date_actual", "shipper_name"];
async function updateOrder(env, id, fields) {
  const sets = [];
  const values = [];
  for (const key of ORDER_EDITABLE_FIELDS) {
    if (key in fields) {
      sets.push(`${key} = ?`);
      values.push(fields[key]);
    }
  }
  if (!sets.length) fail("Không có field hợp lệ để cập nhật.", 400);
  values.push(id);
  const result = await env.DB.prepare(`UPDATE orders SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
  if (!result.meta.changes) fail("Không tìm thấy đơn hàng.", 404);
  return { ok: true };
}

// Dùng chung cho khách tự đặt (checkout.js) VÀ admin tạo tay (channel khác
// nhau trong body) — Worker LUÔN tự sinh id (bỏ qua id client gửi lên nếu
// có) và LUÔN tính lại giá/tồn kho từ D1, không tin số liệu client gửi.
async function createOrder(env, order) {
  if (!order || !order.customerName || !order.customerPhone || !order.address || !order.province || !Array.isArray(order.lines) || !order.lines.length) {
    fail("Thiếu dữ liệu bắt buộc.", 400);
  }

  const { results: products } = await env.DB.prepare("SELECT * FROM products").all();
  const byId = new Map(products.map((p) => [p.id, p]));

  // Tổng kg tính trên các dòng có unit "kg" (giống getCartTotalKg trong
  // js/pricing.js — combo/thiết bị không cộng vào kg).
  let totalKg = 0;
  for (const line of order.lines) {
    const p = byId.get(line.productId);
    if (p && p.unit === "kg") totalKg += Number(line.qty) || 0;
  }

  const computedLines = [];
  let total = 0;
  for (const line of order.lines) {
    const p = byId.get(line.productId);
    if (!p) fail(`Sản phẩm "${line.productId}" không tồn tại.`, 400);
    const qty = Number(line.qty);
    if (!Number.isFinite(qty) || qty <= 0) fail(`Số lượng không hợp lệ cho "${p.name}".`, 400);
    if (qty > p.stock) fail(`"${p.name}" chỉ còn ${p.stock}${p.unit} trong kho.`, 400);

    const isWholesale = isWholesaleApplied(p, totalKg);
    const unitPrice = getUnitPrice(p, totalKg);
    const lineTotal = Math.round(unitPrice * qty);
    total += lineTotal;
    computedLines.push({ productId: p.id, name: p.name, unit: p.unit, qty, unitPrice, lineTotal, priceType: isWholesale ? "wholesale" : "retail" });
  }

  const id = await nextOrderId(env);
  const createdAt = order.createdAt || new Date().toISOString();
  const channel = order.channel || "Website";

  const statements = [
    env.DB.prepare(
      `INSERT INTO orders (id, created_at, customer_name, customer_phone, customer_company, address, province, note, total_kg, total, status, delivery_status, delivery_date_planned, delivery_date_actual, shipper_name, channel)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      id, createdAt, order.customerName, order.customerPhone, order.customerCompany || "",
      order.address, order.province, order.note || "", totalKg, total, "Mới", "Chưa giao",
      order.delivery_date_planned || "", order.delivery_date_actual || "", order.shipper_name || "", channel
    ),
  ];
  for (const l of computedLines) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO order_items (order_id, product_id, name, unit, qty, unit_price, line_total, price_type)
         VALUES (?,?,?,?,?,?,?,?)`
      ).bind(id, l.productId, l.name, l.unit, l.qty, l.unitPrice, l.lineTotal, l.priceType)
    );
    statements.push(env.DB.prepare("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?").bind(l.qty, l.productId));
  }
  await env.DB.batch(statements);

  // Ghi sổ Xuất nhập tồn cho từng dòng (nguồn "order") sau khi batch chính
  // đã chốt tồn kho — chấp nhận rủi ro rất nhỏ về thứ tự ghi ở quy mô nhỏ,
  // giống caveat đã ghi trong worker/README.md.
  for (const l of computedLines) {
    const txId = await nextStockTxId(env, "xuat");
    await env.DB.prepare(
      `INSERT INTO stock_tx (id, type, item_type, item_id, item_name, unit, qty, date, note, source, ref_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    )
      .bind(txId, "xuat", "product", l.productId, l.name, l.unit, l.qty, createdAt, "Bán hàng " + id, "order", id)
      .run();
  }

  return {
    id, createdAt, customerName: order.customerName, customerPhone: order.customerPhone,
    customerCompany: order.customerCompany || "", address: order.address, province: order.province,
    note: order.note || "", lines: computedLines, totalKg, total, status: "Mới",
    delivery_status: "Chưa giao", delivery_date_planned: order.delivery_date_planned || "",
    delivery_date_actual: order.delivery_date_actual || "", shipper_name: order.shipper_name || "", channel,
  };
}
