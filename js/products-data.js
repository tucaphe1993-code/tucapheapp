// =====================================================================
// SẢN PHẨM — cà phê rang mộc + thiết bị pha chế. Đồng bộ thật qua Cloudflare
// Worker + D1 (xem worker/README.md) để mọi máy/nhân viên thấy CHUNG 1 tồn
// kho/giá, thay vì mỗi trình duyệt một bản localStorage riêng như trước.
// TOÀN BỘ hàm đọc/ghi sản phẩm giờ là ASYNC (gọi API) — nơi gọi các hàm này
// phải dùng `await`.
// =====================================================================

// TODO: thay bằng URL Worker thật sau khi deploy, vd:
// "https://tucaphe-order-api.<subdomain>.workers.dev/api"
const API_BASE_URL = "/api";

let _productsCache = null;

async function loadProducts() {
  if (_productsCache) return _productsCache;
  const res = await fetch(`${API_BASE_URL}/products`);
  if (!res.ok) throw new Error("Không tải được danh sách sản phẩm từ máy chủ.");
  _productsCache = await res.json();
  return _productsCache;
}
// Gọi sau mỗi lần sửa/tạo/đổi tồn kho để lần đọc kế tiếp lấy dữ liệu mới nhất.
function invalidateProductsCache() {
  _productsCache = null;
}
async function getVisibleProducts() {
  return (await loadProducts()).filter((p) => p.visible);
}
async function getProductsByCategory(categoryId) {
  return (await getVisibleProducts()).filter((p) => p.category_id === categoryId);
}
async function getProductById(id) {
  return (await loadProducts()).find((p) => p.id === id) || null;
}

// Admin — sửa field thường (KHÔNG phải "stock", Worker sẽ từ chối field đó).
async function updateProductFields(id, fields, adminToken) {
  const res = await fetch(`${API_BASE_URL}/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Cập nhật sản phẩm thất bại.");
  invalidateProductsCache();
  return res.json();
}
// Admin — tạo sản phẩm mới.
async function createProduct(data, adminToken) {
  const res = await fetch(`${API_BASE_URL}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Tạo sản phẩm thất bại.");
  invalidateProductsCache();
  return res.json();
}
// Duy nhất được phép đổi tồn kho — dùng bởi js/stock-data.js's adjustStock().
async function adjustProductStockRemote(id, meta, adminToken) {
  const res = await fetch(`${API_BASE_URL}/products/${id}/stock`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken },
    body: JSON.stringify(meta),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Cập nhật tồn kho thất bại.");
  invalidateProductsCache();
  return res.json();
}

const money = (n) => Math.round(n).toLocaleString("vi-VN") + "₫";
const isInStock = (product) => typeof product.stock === "number" && product.stock > 0;

// Ảnh thật (URL) nếu có, ngược lại rơi về icon emoji đặt sẵn (placeholder).
function productMediaHtml(p) {
  return p.image ? `<img src="${p.image}" alt="${p.name.replace(/"/g, "")}">` : p.icon;
}
