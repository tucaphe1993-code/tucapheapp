// ⚠️ Rào chắn demo — KHÔNG PHẢI bảo mật thật. Xem ghi chú trong admin/index.html.
const ADMIN_DEMO_PASSWORD = "tucaphe2026";
const ADMIN_SESSION_KEY = "tcp_admin_unlocked";
const ORDERS_LOG_KEY = "tcp_orders_local_v1";
const ORDER_STATUSES = ["Mới", "Đã xác nhận", "Đang chuẩn bị", "Đang giao", "Hoàn thành", "Đã hủy"];

// ===== STATE (khai báo sớm để tránh lỗi thứ tự nạp) =====
let selectedRecipeCategory = null;
let recipeSearchQuery = "";
let ingredientSearchQuery = "";
let recipeItemsState = [];
let comboItemsState = [];

function getLocalOrders() {
  return JSON.parse(localStorage.getItem(ORDERS_LOG_KEY) || "[]");
}
function saveLocalOrders(list) {
  localStorage.setItem(ORDERS_LOG_KEY, JSON.stringify(list));
}

function unlockAdmin() {
  document.getElementById("adminLoginScreen").style.display = "none";
  document.getElementById("adminApp").style.display = "block";
  renderProductsTab();
  updateSidebarCounts();
}
if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1") unlockAdmin();

document.getElementById("adminLoginBtn").addEventListener("click", () => {
  const val = document.getElementById("adminPassword").value;
  if (val === ADMIN_DEMO_PASSWORD) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
    unlockAdmin();
  } else {
    document.getElementById("adminLoginError").style.display = "block";
    document.getElementById("adminLoginError").textContent = "Sai mật khẩu quản trị.";
  }
});
document.getElementById("adminLogoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  location.reload();
});

// ===== HELPERS =====
function slugify(name) {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now().toString().slice(-4);
}

// ===== TAB SWITCHING =====
const TAB_TITLES = {
  products: "Sản phẩm", categories: "Danh mục", combos: "Combo", orders: "Đơn hàng", customers: "Khách hàng",
  ingredients: "Nguyên liệu", recipes: "Công thức pha chế",
  "pricing-calc": "Bảng tính giá bán", breakeven: "Điểm hoà vốn", "about-system": "Về hệ thống",
};
const ALL_TABS = Object.keys(TAB_TITLES);

function switchTab(tab, cat) {
  if (tab === "recipes") selectedRecipeCategory = cat || null;
  document.querySelectorAll(".sidebar-link[data-tab]").forEach(b => {
    const isThisTab = b.dataset.tab === tab;
    const catMatches = tab !== "recipes" || (b.dataset.cat || "") === (selectedRecipeCategory || "");
    b.classList.toggle("active", isThisTab && catMatches);
  });
  ALL_TABS.forEach(t => {
    document.getElementById("tab-" + t).style.display = t === tab ? "block" : "none";
  });
  document.getElementById("adminBreadcrumb").textContent = TAB_TITLES[tab];
  if (tab === "categories") renderCategoriesTab();
  if (tab === "combos") renderCombosTab();
  if (tab === "orders") renderOrdersTab();
  if (tab === "customers") renderCustomersTab();
  if (tab === "ingredients") renderIngredientsTab();
  if (tab === "recipes") renderRecipesTab();
  if (tab === "pricing-calc") renderPricingCalcTab();
  if (tab === "breakeven") recalcBreakeven();
  document.getElementById("dataToolbar").style.display = (tab === "ingredients" || tab === "recipes") ? "flex" : "none";
}
document.querySelectorAll(".sidebar-link[data-tab]").forEach(btn => {
  btn.addEventListener("click", () => {
    switchTab(btn.dataset.tab, btn.dataset.cat);
  });
});

// ===== TAB: SẢN PHẨM =====
function renderProductsTab() {
  const products = loadProducts();
  document.getElementById("productsTableBody").innerHTML = products.map(p => {
    const cat = getCategoryById(p.category_id);
    return `
    <tr>
      <td>${p.icon} ${p.name}</td>
      <td>${cat ? cat.name : "—"}</td>
      <td>${money(p.retail_price)}</td>
      <td>${money(p.wholesale_price)}</td>
      <td>${p.wholesale_min_kg}${p.unit}</td>
      <td>${p.stock}${p.unit}</td>
      <td><span class="status-badge ${p.visible ? "visible" : "hidden"}">${p.visible ? "Đang bán" : "Đã ẩn"}</span></td>
      <td style="display:flex;gap:6px;">
        <button class="btn secondary sm" data-edit="${p.id}">Sửa</button>
        <button class="btn secondary sm" data-toggle="${p.id}">${p.visible ? "Ẩn" : "Hiện"}</button>
      </td>
    </tr>
  `;
  }).join("");

  document.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openProductModal(b.dataset.edit)));
  document.querySelectorAll("[data-toggle]").forEach(b => b.addEventListener("click", () => {
    const list = loadProducts();
    const p = list.find(x => x.id === b.dataset.toggle);
    p.visible = !p.visible;
    saveProducts(list);
    renderProductsTab();
  }));
}

document.getElementById("addProductBtn").addEventListener("click", () => openProductModal(null));
function openProductModal(id) {
  const p = id ? getProductById(id) : null;
  document.getElementById("productModalTitle").textContent = p ? "Sửa sản phẩm" : "Thêm sản phẩm";
  document.getElementById("pf_id").value = p ? p.id : "";
  document.getElementById("pf_category_id").innerHTML = loadCategories().map(c => `<option value="${c.id}">${c.name}</option>`).join("");
  document.getElementById("pf_category_id").value = p ? p.category_id : loadCategories()[0].id;
  document.getElementById("pf_name").value = p ? p.name : "";
  document.getElementById("pf_icon").value = p ? p.icon : "☕";
  document.getElementById("pf_image").value = p && p.image ? p.image : "";
  document.getElementById("pf_short_desc").value = p ? p.short_desc : "";
  document.getElementById("pf_description").value = p ? p.description : "";
  document.getElementById("pf_unit").value = p ? p.unit : "kg";
  document.getElementById("pf_retail_price").value = p ? p.retail_price : "";
  document.getElementById("pf_wholesale_price").value = p ? p.wholesale_price : "";
  document.getElementById("pf_wholesale_min_kg").value = p ? p.wholesale_min_kg : 5;
  document.getElementById("pf_stock").value = p ? p.stock : 0;
  document.getElementById("productModal").style.display = "flex";
  document.getElementById("productModalOverlay").classList.add("show");
}
function closeProductModal() {
  document.getElementById("productModal").style.display = "none";
  document.getElementById("productModalOverlay").classList.remove("show");
}
document.getElementById("productModalCancel").addEventListener("click", closeProductModal);
document.getElementById("productModalOverlay").addEventListener("click", closeProductModal);

document.getElementById("productForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("pf_id").value;
  const list = loadProducts();
  const data = {
    category_id: document.getElementById("pf_category_id").value,
    name: document.getElementById("pf_name").value.trim(),
    icon: document.getElementById("pf_icon").value.trim() || "☕",
    image: document.getElementById("pf_image").value.trim(),
    short_desc: document.getElementById("pf_short_desc").value.trim(),
    description: document.getElementById("pf_description").value.trim(),
    unit: document.getElementById("pf_unit").value.trim(),
    retail_price: Number(document.getElementById("pf_retail_price").value),
    wholesale_price: Number(document.getElementById("pf_wholesale_price").value),
    wholesale_min_kg: Number(document.getElementById("pf_wholesale_min_kg").value),
    stock: Number(document.getElementById("pf_stock").value),
  };
  if (id) {
    const p = list.find(x => x.id === id);
    Object.assign(p, data);
  } else {
    list.push({ id: slugify(data.name), visible: true, ...data });
  }
  saveProducts(list);
  closeProductModal();
  renderProductsTab();
});

// ===== TAB: DANH MỤC =====
function renderCategoriesTab() {
  const categories = loadCategories();
  const products = loadProducts();
  document.getElementById("categoriesTableBody").innerHTML = categories.map(c => `
    <tr>
      <td>${c.name}</td>
      <td>${c.tagline}</td>
      <td>${products.filter(p => p.category_id === c.id).length}</td>
      <td><button class="btn secondary sm" data-edit-category="${c.id}">Sửa</button></td>
    </tr>
  `).join("");
  document.querySelectorAll("[data-edit-category]").forEach(b => b.addEventListener("click", () => openCategoryModal(b.dataset.editCategory)));
}
function openCategoryModal(id) {
  const c = getCategoryById(id);
  document.getElementById("cf_id").value = c.id;
  document.getElementById("cf_name").value = c.name;
  document.getElementById("cf_tagline").value = c.tagline;
  document.getElementById("categoryModal").style.display = "flex";
  document.getElementById("categoryModalOverlay").classList.add("show");
}
function closeCategoryModal() {
  document.getElementById("categoryModal").style.display = "none";
  document.getElementById("categoryModalOverlay").classList.remove("show");
}
document.getElementById("categoryModalCancel").addEventListener("click", closeCategoryModal);
document.getElementById("categoryModalOverlay").addEventListener("click", closeCategoryModal);
document.getElementById("categoryForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("cf_id").value;
  const list = loadCategories();
  const c = list.find(x => x.id === id);
  c.name = document.getElementById("cf_name").value.trim();
  c.tagline = document.getElementById("cf_tagline").value.trim();
  saveCategories(list);
  closeCategoryModal();
  renderCategoriesTab();
});

// ===== TAB: COMBO =====
function renderCombosTab() {
  const combos = loadCombos();
  document.getElementById("combosTableBody").innerHTML = combos.map(c => `
    <tr>
      <td>${c.icon} ${c.name}</td>
      <td>${c.price_from ? money(c.price_from) : "Liên hệ báo giá"}</td>
      <td>${c.items.length}</td>
      <td><span class="status-badge ${c.visible ? "visible" : "hidden"}">${c.visible ? "Đang hiện" : "Đã ẩn"}</span></td>
      <td style="display:flex;gap:6px;">
        <button class="btn secondary sm" data-edit-combo="${c.id}">Sửa</button>
        <button class="btn secondary sm" data-toggle-combo="${c.id}">${c.visible ? "Ẩn" : "Hiện"}</button>
      </td>
    </tr>
  `).join("");
  document.querySelectorAll("[data-edit-combo]").forEach(b => b.addEventListener("click", () => openComboModal(b.dataset.editCombo)));
  document.querySelectorAll("[data-toggle-combo]").forEach(b => b.addEventListener("click", () => {
    const list = loadCombos();
    const c = list.find(x => x.id === b.dataset.toggleCombo);
    c.visible = !c.visible;
    saveCombos(list);
    renderCombosTab();
  }));
}

function comboLineCostLabel(row) {
  if (!row.product_id) return "—";
  const p = getProductById(row.product_id);
  return p ? `${p.icon} ${p.name}` : "—";
}
function renderComboItemsRows() {
  const products = loadProducts();
  const body = document.getElementById("comboItemsBody");
  body.innerHTML = comboItemsState.length ? comboItemsState.map((row, idx) => `
    <tr>
      <td><input type="text" data-row-label="${idx}" value="${row.label}" placeholder="Vd: Máy pha"></td>
      <td>
        <select data-row-product="${idx}">
          <option value="">— Không liên kết —</option>
          ${products.map(p => `<option value="${p.id}" ${p.id === row.product_id ? "selected" : ""}>${p.name}</option>`).join("")}
        </select>
      </td>
      <td><button type="button" class="btn secondary sm" data-row-remove="${idx}">Xoá</button></td>
    </tr>
  `).join("") : `<tr><td colspan="3" style="text-align:center;color:var(--muted);">Chưa có hạng mục nào.</td></tr>`;

  body.querySelectorAll("[data-row-label]").forEach(inp => inp.addEventListener("input", () => {
    comboItemsState[Number(inp.dataset.rowLabel)].label = inp.value;
  }));
  body.querySelectorAll("[data-row-product]").forEach(sel => sel.addEventListener("change", () => {
    comboItemsState[Number(sel.dataset.rowProduct)].product_id = sel.value || null;
  }));
  body.querySelectorAll("[data-row-remove]").forEach(btn => btn.addEventListener("click", () => {
    comboItemsState.splice(Number(btn.dataset.rowRemove), 1);
    renderComboItemsRows();
  }));
}
document.getElementById("addComboItemRowBtn").addEventListener("click", () => {
  comboItemsState.push({ label: "", product_id: null });
  renderComboItemsRows();
});

document.getElementById("addComboBtn").addEventListener("click", () => openComboModal(null));
function openComboModal(id) {
  const c = id ? getComboById(id) : null;
  document.getElementById("comboModalTitle").textContent = c ? "Sửa combo" : "Tạo combo";
  document.getElementById("cb_id").value = c ? c.id : "";
  document.getElementById("cb_name").value = c ? c.name : "";
  document.getElementById("cb_tagline").value = c ? c.tagline : "";
  document.getElementById("cb_icon").value = c ? c.icon : "📦";
  document.getElementById("cb_image").value = c && c.image ? c.image : "";
  document.getElementById("cb_price_from").value = c && c.price_from ? c.price_from : "";
  comboItemsState = c ? c.items.map(it => ({ ...it })) : [];
  renderComboItemsRows();
  document.getElementById("comboModal").style.display = "flex";
  document.getElementById("comboModalOverlay").classList.add("show");
}
function closeComboModal() {
  document.getElementById("comboModal").style.display = "none";
  document.getElementById("comboModalOverlay").classList.remove("show");
}
document.getElementById("comboModalCancel").addEventListener("click", closeComboModal);
document.getElementById("comboModalOverlay").addEventListener("click", closeComboModal);

document.getElementById("comboForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("cb_id").value;
  const priceVal = document.getElementById("cb_price_from").value;
  const data = {
    name: document.getElementById("cb_name").value.trim(),
    tagline: document.getElementById("cb_tagline").value.trim(),
    icon: document.getElementById("cb_icon").value.trim() || "📦",
    image: document.getElementById("cb_image").value.trim(),
    price_from: priceVal ? Number(priceVal) : null,
    items: comboItemsState.filter(row => row.label.trim()),
  };
  const list = loadCombos();
  if (id) {
    Object.assign(list.find(x => x.id === id), data);
  } else {
    list.push({ id: slugify(data.name), visible: true, ...data });
  }
  saveCombos(list);
  closeComboModal();
  renderCombosTab();
});

// ===== TAB: ĐƠN HÀNG =====
function renderOrdersTab() {
  const orders = getLocalOrders();
  document.getElementById("ordersTableBody").innerHTML = orders.length ? orders.map(o => `
    <tr>
      <td>${o.id}</td>
      <td>${new Date(o.createdAt).toLocaleString("vi-VN")}</td>
      <td>${o.customerName}${o.customerCompany ? " (" + o.customerCompany + ")" : ""}</td>
      <td>${o.customerPhone}</td>
      <td>${o.totalKg}kg</td>
      <td>${money(o.total)}</td>
      <td>${o.syncedToBackend ? "✅ Đã gửi" : "⏳ Chưa gửi (chưa có backend)"}</td>
      <td>
        <select data-order-status="${o.id}">
          ${ORDER_STATUSES.map(s => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="8" style="text-align:center;color:var(--muted);">Chưa có đơn hàng nào.</td></tr>`;

  document.querySelectorAll("[data-order-status]").forEach(sel => {
    sel.addEventListener("change", () => {
      const orders = getLocalOrders();
      const o = orders.find(x => x.id === sel.dataset.orderStatus);
      o.status = sel.value;
      saveLocalOrders(orders);
    });
  });
}

// ===== TAB: KHÁCH HÀNG (rút từ lịch sử đơn) =====
function renderCustomersTab() {
  const customers = loadCustomers();
  document.getElementById("customersTableBody").innerHTML = customers.length ? customers.map(c => `
    <tr>
      <td>${c.name}</td><td>${c.phone}</td><td>${c.company || "—"}</td>
      <td>${c.orderCount}</td><td>${money(c.totalSpent)}</td>
      <td>${new Date(c.lastOrderAt).toLocaleDateString("vi-VN")}</td>
    </tr>
  `).join("") : `<tr><td colspan="6" style="text-align:center;color:var(--muted);">Chưa có khách hàng nào.</td></tr>`;
}

// ===== SỐ LƯỢNG + DANH MỤC TRÊN SIDEBAR =====
function getRecipeCategoryCounts() {
  const counts = new Map();
  loadRecipes().forEach(r => counts.set(r.category, (counts.get(r.category) || 0) + 1));
  return counts;
}
function updateSidebarCounts() {
  document.getElementById("ingredientsCount").textContent = loadIngredients().length || "";
  document.getElementById("recipesCount").textContent = loadRecipes().length || "";

  const nav = document.getElementById("sidebarRecipeCategories");
  const counts = getRecipeCategoryCounts();
  nav.innerHTML = [...counts.entries()].map(([cat, count], idx) => `
    <button class="sidebar-link sub" data-tab="recipes" data-cat="${cat}"><span class="sidebar-num">${idx + 1}</span><span>${cat}</span> <span class="sidebar-count">${count}</span></button>
  `).join("");
  nav.querySelectorAll("[data-tab]").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab, btn.dataset.cat)));
  nav.querySelectorAll("[data-tab]").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === "recipes" && b.dataset.cat === (selectedRecipeCategory || ""));
  });
}

// ===== TAB: NGUYÊN LIỆU =====
document.getElementById("ingredientSearchInput").addEventListener("input", (e) => {
  ingredientSearchQuery = e.target.value;
  renderIngredientsTab();
});

function renderIngredientsTab() {
  const all = loadIngredients();
  const q = ingredientSearchQuery.trim().toLowerCase();
  const ingredients = q ? all.filter(i => i.name.toLowerCase().includes(q)) : all;

  document.getElementById("ingredientsTableBody").innerHTML = ingredients.length ? ingredients.map(i => `
    <tr>
      <td>${i.name}</td>
      <td>${i.unit}</td>
      <td>${money(i.unit_price)}</td>
      <td style="display:flex;gap:6px;">
        <button class="btn secondary sm" data-edit-ingredient="${i.id}">Sửa</button>
        <button class="btn secondary sm" data-delete-ingredient="${i.id}">Xoá</button>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="4" style="text-align:center;color:var(--muted);">${q ? "Không tìm thấy nguyên liệu nào." : "Chưa có nguyên liệu nào."}</td></tr>`;

  document.querySelectorAll("[data-edit-ingredient]").forEach(b => b.addEventListener("click", () => openIngredientModal(b.dataset.editIngredient)));
  document.querySelectorAll("[data-delete-ingredient]").forEach(b => b.addEventListener("click", () => {
    if (!confirm("Xoá nguyên liệu này?")) return;
    saveIngredients(loadIngredients().filter(x => x.id !== b.dataset.deleteIngredient));
    renderIngredientsTab();
    updateSidebarCounts();
  }));
  updateSidebarCounts();
}

document.getElementById("addIngredientBtn").addEventListener("click", () => openIngredientModal(null));
function openIngredientModal(id) {
  const item = id ? getIngredientById(id) : null;
  document.getElementById("ingredientModalTitle").textContent = item ? "Sửa nguyên liệu" : "Thêm nguyên liệu";
  document.getElementById("if_id").value = item ? item.id : "";
  document.getElementById("if_name").value = item ? item.name : "";
  document.getElementById("if_unit").value = item ? item.unit : "";
  document.getElementById("if_unit_price").value = item ? item.unit_price : "";
  document.getElementById("ingredientModal").style.display = "flex";
  document.getElementById("ingredientModalOverlay").classList.add("show");
}
function closeIngredientModal() {
  document.getElementById("ingredientModal").style.display = "none";
  document.getElementById("ingredientModalOverlay").classList.remove("show");
}
document.getElementById("ingredientModalCancel").addEventListener("click", closeIngredientModal);
document.getElementById("ingredientModalOverlay").addEventListener("click", closeIngredientModal);

document.getElementById("ingredientForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("if_id").value;
  const list = loadIngredients();
  const data = {
    name: document.getElementById("if_name").value.trim(),
    unit: document.getElementById("if_unit").value.trim(),
    unit_price: Number(document.getElementById("if_unit_price").value),
  };
  if (id) {
    Object.assign(list.find(x => x.id === id), data);
  } else {
    list.push({ id: slugify(data.name), ...data });
  }
  saveIngredients(list);
  closeIngredientModal();
  renderIngredientsTab();
});

// ===== TAB: CÔNG THỨC PHA CHẾ =====
document.getElementById("recipeSearchInput").addEventListener("input", (e) => {
  recipeSearchQuery = e.target.value;
  renderRecipesTab();
});

function renderRecipesTab() {
  const allRecipes = loadRecipes();
  const ingredients = loadIngredients();

  // Cột danh mục bên trái: đếm số món theo từng danh mục (không phụ thuộc ô tìm kiếm)
  const categoryCounts = new Map();
  allRecipes.forEach(r => categoryCounts.set(r.category, (categoryCounts.get(r.category) || 0) + 1));
  if (selectedRecipeCategory && !categoryCounts.has(selectedRecipeCategory)) selectedRecipeCategory = null;

  const nav = document.getElementById("recipesCategoryNav");
  nav.innerHTML = `
    <button class="recipe-cat-link ${!selectedRecipeCategory ? "active" : ""}" data-cat="">Tất cả <span class="count">${allRecipes.length}</span></button>
    ${[...categoryCounts.entries()].map(([cat, count]) => `
      <button class="recipe-cat-link ${selectedRecipeCategory === cat ? "active" : ""}" data-cat="${cat}">${cat} <span class="count">${count}</span></button>
    `).join("")}
  `;
  nav.querySelectorAll("[data-cat]").forEach(btn => btn.addEventListener("click", () => switchTab("recipes", btn.dataset.cat)));

  // Lọc theo danh mục đang chọn + ô tìm kiếm
  const q = recipeSearchQuery.trim().toLowerCase();
  let recipes = selectedRecipeCategory ? allRecipes.filter(r => r.category === selectedRecipeCategory) : allRecipes;
  if (q) recipes = recipes.filter(r => r.name.toLowerCase().includes(q));

  const groups = new Map();
  recipes.forEach(r => {
    if (!groups.has(r.category)) groups.set(r.category, []);
    groups.get(r.category).push(r);
  });

  const headerHtml = selectedRecipeCategory ? `
    <div class="recipes-content-header">
      <button class="recipes-back-link" id="recipesBackToAll">← Xem tất cả món</button>
      <span style="color:var(--muted);font-size:0.85rem;">Nhóm ${selectedRecipeCategory} · ${categoryCounts.get(selectedRecipeCategory) || 0} món</span>
    </div>
  ` : "";

  const container = document.getElementById("recipesGroups");
  container.innerHTML = headerHtml + (recipes.length ? [...groups.entries()].map(([category, list]) => `
    <div>
      <h3 class="section-title recipe-group-title">${category} · ${list.length}</h3>
      <div class="recipe-cards-grid">
        ${list.map(r => `
          <div class="recipe-card">
            <div class="recipe-card-head">
              <div>
                <div class="recipe-card-name">${r.name.toUpperCase()}</div>
                <div class="recipe-card-cat">${r.category}</div>
              </div>
              <div class="recipe-card-cost">${money(calcRecipeCost(r, ingredients))}<span>GIÁ VỐN</span></div>
            </div>
            <table class="recipe-ingredient-table">
              <thead><tr><th>Nguyên liệu</th><th>Định lượng</th><th>Giá/ĐV</th><th>Thành tiền</th></tr></thead>
              <tbody>
                ${r.items.map(it => {
                  const ing = ingredients.find(i => i.id === it.ingredient_id);
                  return `<tr>
                    <td>${ing ? ing.name : "(đã xoá)"}</td>
                    <td>${it.qty} ${ing ? ing.unit : ""}</td>
                    <td>${ing ? money(ing.unit_price) : "—"}</td>
                    <td>${ing ? money(ing.unit_price * it.qty) : "—"}</td>
                  </tr>`;
                }).join("") || `<tr><td colspan="4" style="text-align:center;color:var(--muted);">Chưa có nguyên liệu.</td></tr>`}
              </tbody>
            </table>
            ${r.instructions ? `
              <div class="recipe-instructions">
                <strong>CÁCH LÀM</strong>
                <ol>${r.instructions.split("\n").filter(s => s.trim()).map(step => `<li>${step.trim()}</li>`).join("")}</ol>
              </div>
            ` : ""}
            <div class="recipe-card-actions">
              <button class="btn secondary sm" data-edit-recipe="${r.id}">Sửa</button>
              <button class="btn secondary sm" data-delete-recipe="${r.id}">Xoá</button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("") : `<p style="color:var(--muted);">${q || selectedRecipeCategory ? "Không tìm thấy công thức nào." : "Chưa có công thức nào."}</p>`);

  if (selectedRecipeCategory) {
    document.getElementById("recipesBackToAll").addEventListener("click", () => switchTab("recipes", null));
  }

  document.querySelectorAll("[data-edit-recipe]").forEach(b => b.addEventListener("click", () => openRecipeModal(b.dataset.editRecipe)));
  document.querySelectorAll("[data-delete-recipe]").forEach(b => b.addEventListener("click", () => {
    if (!confirm("Xoá công thức này?")) return;
    saveRecipes(loadRecipes().filter(x => x.id !== b.dataset.deleteRecipe));
    renderRecipesTab();
    updateSidebarCounts();
  }));
  updateSidebarCounts();
}

// ----- Modal công thức: dòng nguyên liệu động -----
function lineCost(row, ingredients) {
  const ing = ingredients.find(i => i.id === row.ingredient_id);
  return ing ? ing.unit_price * row.qty : 0;
}

function renderRecipeItemsRows() {
  const ingredients = loadIngredients();
  const body = document.getElementById("recipeItemsBody");
  body.innerHTML = recipeItemsState.length ? recipeItemsState.map((row, idx) => `
    <tr>
      <td>
        <select data-row-ingredient="${idx}">
          <option value="">— Chọn nguyên liệu —</option>
          ${ingredients.map(i => `<option value="${i.id}" ${i.id === row.ingredient_id ? "selected" : ""}>${i.name} (${i.unit})</option>`).join("")}
        </select>
      </td>
      <td><input type="number" min="0" step="0.01" data-row-qty="${idx}" value="${row.qty}" style="width:90px;"></td>
      <td>${money(lineCost(row, ingredients))}</td>
      <td><button type="button" class="btn secondary sm" data-row-remove="${idx}">Xoá</button></td>
    </tr>
  `).join("") : `<tr><td colspan="4" style="text-align:center;color:var(--muted);">Chưa có nguyên liệu nào trong công thức.</td></tr>`;

  document.querySelectorAll("[data-row-ingredient]").forEach(sel => sel.addEventListener("change", () => {
    recipeItemsState[Number(sel.dataset.rowIngredient)].ingredient_id = sel.value;
    renderRecipeItemsRows();
  }));
  document.querySelectorAll("[data-row-qty]").forEach(inp => inp.addEventListener("input", () => {
    recipeItemsState[Number(inp.dataset.rowQty)].qty = Number(inp.value) || 0;
    renderRecipeItemsRows();
  }));
  document.querySelectorAll("[data-row-remove]").forEach(btn => btn.addEventListener("click", () => {
    recipeItemsState.splice(Number(btn.dataset.rowRemove), 1);
    renderRecipeItemsRows();
  }));

  const total = recipeItemsState.reduce((sum, row) => sum + lineCost(row, ingredients), 0);
  document.getElementById("recipeTotalCost").textContent = money(total);
}

document.getElementById("addRecipeItemRowBtn").addEventListener("click", () => {
  recipeItemsState.push({ ingredient_id: "", qty: 0 });
  renderRecipeItemsRows();
});

document.getElementById("addRecipeBtn").addEventListener("click", () => openRecipeModal(null));
function openRecipeModal(id) {
  const r = id ? getRecipeById(id) : null;
  document.getElementById("recipeModalTitle").textContent = r ? "Sửa công thức" : "Thêm công thức";
  document.getElementById("rf_id").value = r ? r.id : "";
  document.getElementById("rf_name").value = r ? r.name : "";
  document.getElementById("rf_category").value = r ? r.category : "";
  document.getElementById("rf_instructions").value = r ? r.instructions : "";
  recipeItemsState = r ? r.items.map(it => ({ ...it })) : [];

  const categories = [...new Set(loadRecipes().map(x => x.category))];
  document.getElementById("recipeCategoryList").innerHTML = categories.map(c => `<option value="${c}"></option>`).join("");

  renderRecipeItemsRows();
  document.getElementById("recipeModal").style.display = "flex";
  document.getElementById("recipeModalOverlay").classList.add("show");
}
function closeRecipeModal() {
  document.getElementById("recipeModal").style.display = "none";
  document.getElementById("recipeModalOverlay").classList.remove("show");
}
document.getElementById("recipeModalCancel").addEventListener("click", closeRecipeModal);
document.getElementById("recipeModalOverlay").addEventListener("click", closeRecipeModal);

document.getElementById("recipeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("rf_id").value;
  const list = loadRecipes();
  const data = {
    name: document.getElementById("rf_name").value.trim(),
    category: document.getElementById("rf_category").value.trim(),
    instructions: document.getElementById("rf_instructions").value.trim(),
    items: recipeItemsState.filter(row => row.ingredient_id && row.qty > 0),
  };
  if (id) {
    Object.assign(list.find(x => x.id === id), data);
  } else {
    list.push({ id: slugify(data.name), ...data });
  }
  saveRecipes(list);
  closeRecipeModal();
  renderRecipesTab();
});

// ===== TAB: BẢNG TÍNH GIÁ BÁN =====
function renderPricingCalcTab() {
  const recipes = loadRecipes();
  const ingredients = loadIngredients();
  const sel = document.getElementById("pc_recipe");
  const current = sel.value;
  sel.innerHTML = `<option value="">— Nhập giá vốn thủ công —</option>` +
    recipes.map(r => `<option value="${r.id}">${r.name} (${r.category})</option>`).join("");
  sel.value = current;
  recalcPricingCalc();
}
document.getElementById("pc_recipe").addEventListener("change", () => {
  const id = document.getElementById("pc_recipe").value;
  if (id) {
    const r = getRecipeById(id);
    document.getElementById("pc_cost").value = Math.round(calcRecipeCost(r, loadIngredients()));
  }
  recalcPricingCalc();
});
document.getElementById("pc_cost").addEventListener("input", recalcPricingCalc);
document.getElementById("pc_margin").addEventListener("input", recalcPricingCalc);
function recalcPricingCalc() {
  const cost = Number(document.getElementById("pc_cost").value) || 0;
  const margin = Number(document.getElementById("pc_margin").value) || 0;
  const price = cost * (1 + margin / 100);
  const profit = price - cost;
  document.getElementById("pc_out_cost").textContent = money(cost);
  document.getElementById("pc_out_profit").textContent = money(profit);
  document.getElementById("pc_out_price").textContent = money(price);
}

// ===== TAB: ĐIỂM HOÀ VỐN =====
["be_fixed_cost", "be_price", "be_cost"].forEach(id => document.getElementById(id).addEventListener("input", recalcBreakeven));
function recalcBreakeven() {
  const fixedCost = Number(document.getElementById("be_fixed_cost").value) || 0;
  const price = Number(document.getElementById("be_price").value) || 0;
  const cost = Number(document.getElementById("be_cost").value) || 0;
  const margin = price - cost;
  document.getElementById("be_out_margin").textContent = money(margin);
  if (margin > 0) {
    const units = Math.ceil(fixedCost / margin);
    document.getElementById("be_out_units").textContent = units.toLocaleString("vi-VN");
    document.getElementById("be_out_revenue").textContent = money(units * price);
  } else {
    document.getElementById("be_out_units").textContent = "—";
    document.getElementById("be_out_revenue").textContent = "0₫";
  }
}

// ===== TOOLBAR DỮ LIỆU: In/PDF, Lưu vào file, Nạp từ file khác, Khôi phục gốc, Bản gốc =====
document.getElementById("btnPrint").addEventListener("click", () => window.print());

document.getElementById("btnExport").addEventListener("click", () => {
  const data = { ingredients: loadIngredients(), recipes: loadRecipes(), exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tu-ca-phe-cong-thuc-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("importFileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try {
      data = JSON.parse(reader.result);
    } catch {
      alert("File không hợp lệ (không đọc được JSON).");
      e.target.value = "";
      return;
    }
    if (!Array.isArray(data.ingredients) || !Array.isArray(data.recipes)) {
      alert("File không đúng định dạng (thiếu danh sách nguyên liệu/công thức).");
      e.target.value = "";
      return;
    }
    if (!confirm(`Nạp file này sẽ THAY THẾ toàn bộ ${loadIngredients().length} nguyên liệu và ${loadRecipes().length} công thức hiện có. Tiếp tục?`)) {
      e.target.value = "";
      return;
    }
    saveIngredients(data.ingredients);
    saveRecipes(data.recipes);
    selectedRecipeCategory = null;
    renderIngredientsTab();
    renderRecipesTab();
    e.target.value = "";
    alert("Đã nạp dữ liệu từ file thành công.");
  };
  reader.readAsText(file);
});

document.getElementById("btnResetData").addEventListener("click", () => {
  if (!confirm("Khôi phục gốc sẽ XOÁ TOÀN BỘ nguyên liệu và công thức hiện có, đưa hệ thống về trạng thái ban đầu (rỗng). Nếu chưa lưu file backup, dữ liệu sẽ mất vĩnh viễn. Tiếp tục?")) return;
  saveIngredients([]);
  saveRecipes([]);
  selectedRecipeCategory = null;
  renderIngredientsTab();
  renderRecipesTab();
});

document.getElementById("btnAboutOriginal").addEventListener("click", () => {
  document.getElementById("aboutOriginalModal").style.display = "flex";
  document.getElementById("aboutOriginalOverlay").classList.add("show");
});
function closeAboutOriginalModal() {
  document.getElementById("aboutOriginalModal").style.display = "none";
  document.getElementById("aboutOriginalOverlay").classList.remove("show");
}
document.getElementById("aboutOriginalClose").addEventListener("click", closeAboutOriginalModal);
document.getElementById("aboutOriginalOverlay").addEventListener("click", closeAboutOriginalModal);
