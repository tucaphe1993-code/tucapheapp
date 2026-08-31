// =====================================================================
// CÔNG THỨC PHA CHẾ — mỗi công thức gồm danh sách nguyên liệu (id + số
// lượng) và tự tính giá vốn dựa trên đơn giá nguyên liệu hiện tại.
// Khởi tạo rỗng, nhập dữ liệu thật qua khu quản trị (tab Công thức pha chế).
// =====================================================================

const RECIPES_STORE_KEY = "tcp_recipes_v1";

const RECIPES_SEED = [];

function loadRecipes() {
  const saved = JSON.parse(localStorage.getItem(RECIPES_STORE_KEY) || "null");
  if (saved && Array.isArray(saved)) return saved;
  const seeded = RECIPES_SEED.map(r => ({ ...r }));
  localStorage.setItem(RECIPES_STORE_KEY, JSON.stringify(seeded));
  return seeded;
}
function saveRecipes(list) {
  localStorage.setItem(RECIPES_STORE_KEY, JSON.stringify(list));
}
function getRecipeById(id) {
  return loadRecipes().find(r => r.id === id) || null;
}
function calcRecipeCost(recipe, ingredients) {
  return recipe.items.reduce((sum, it) => {
    const ing = ingredients.find(i => i.id === it.ingredient_id);
    return sum + (ing ? ing.unit_price * it.qty : 0);
  }, 0);
}
