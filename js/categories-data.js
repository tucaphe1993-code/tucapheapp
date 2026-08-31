// =====================================================================
// DANH MỤC SẢN PHẨM — cà phê, máy pha, máy xay, thiết bị pha chế.
// Giữ cố định 4 danh mục (gắn với menu điều hướng của site), admin chỉ
// sửa được tên/mô tả ngắn — không thêm/xoá danh mục để tránh vỡ điều
// hướng (nav) và các link ?cat=... đang dùng cố định.
// =====================================================================

const CATEGORIES_STORE_KEY = "tcp_categories_v1";

const CATEGORIES_SEED = [
  { id: "ca-phe", name: "Cà phê", tagline: "Cà phê rang mộc cho quán và gia đình" },
  { id: "may-pha", name: "Máy pha", tagline: "Máy pha espresso cho mọi mô hình" },
  { id: "may-xay", name: "Máy xay", tagline: "Máy xay chuyên nghiệp cho quán cà phê" },
  { id: "thiet-bi", name: "Thiết bị", tagline: "Dụng cụ pha chế chuyên nghiệp" },
];

function loadCategories() {
  const saved = JSON.parse(localStorage.getItem(CATEGORIES_STORE_KEY) || "null");
  if (saved && Array.isArray(saved)) return saved;
  const seeded = CATEGORIES_SEED.map(c => ({ ...c }));
  localStorage.setItem(CATEGORIES_STORE_KEY, JSON.stringify(seeded));
  return seeded;
}
function saveCategories(list) {
  localStorage.setItem(CATEGORIES_STORE_KEY, JSON.stringify(list));
}
function getCategoryById(id) {
  return loadCategories().find(c => c.id === id) || null;
}
