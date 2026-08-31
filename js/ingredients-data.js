// =====================================================================
// THƯ VIỆN NGUYÊN LIỆU — dùng để tính giá vốn công thức pha chế.
// Khởi tạo rỗng, nhập dữ liệu thật qua khu quản trị (tab Nguyên liệu).
// =====================================================================

const INGREDIENTS_STORE_KEY = "tcp_ingredients_v1";

const INGREDIENTS_SEED = [];

function loadIngredients() {
  const saved = JSON.parse(localStorage.getItem(INGREDIENTS_STORE_KEY) || "null");
  if (saved && Array.isArray(saved)) return saved;
  const seeded = INGREDIENTS_SEED.map(i => ({ ...i }));
  localStorage.setItem(INGREDIENTS_STORE_KEY, JSON.stringify(seeded));
  return seeded;
}
function saveIngredients(list) {
  localStorage.setItem(INGREDIENTS_STORE_KEY, JSON.stringify(list));
}
function getIngredientById(id) {
  return loadIngredients().find(i => i.id === id) || null;
}
