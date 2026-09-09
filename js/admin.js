// ⚠️ Rào chắn demo — KHÔNG PHẢI bảo mật thật. Xem ghi chú trong admin/index.html.
const ADMIN_DEMO_PASSWORD = "tucaphe2026";
const ADMIN_SESSION_KEY = "tcp_admin_unlocked";
const ORDER_STATUSES = ["Mới", "Đã xác nhận", "Đang chuẩn bị", "Đang giao", "Hoàn thành", "Đã hủy"];

// Token dùng chung để gọi các API cần quyền quản trị (Worker kiểm tra header
// X-Admin-Token) — PHẢI khớp đúng giá trị đã đặt bằng `wrangler secret put
// ADMIN_TOKEN` (xem worker/README.md). Đây KHÔNG phải tài khoản riêng từng
// nhân viên, chỉ là 1 "mật khẩu API" dùng chung — không phải bảo mật thật.
const ADMIN_TOKEN = "REPLACE_WITH_YOUR_ADMIN_TOKEN";
const ADMIN_TOKEN_SESSION_KEY = "tcp_admin_token";
function adminToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_SESSION_KEY);
}

// ===== STATE (khai báo sớm để tránh lỗi thứ tự nạp) =====
let selectedRecipeCategory = null;
let recipeSearchQuery = "";
let ingredientSearchQuery = "";
let recipeItemsState = [];
let comboItemsState = [];
let stockTxItemsState = [];
let productionInputsState = [];
let orderItemsState = [];

// Đơn hàng giờ nằm trên server (Cloudflare Worker + D1) — mọi nhân viên/thiết
// bị đọc chung 1 danh sách, không còn localStorage riêng từng máy. Giữ
// nguyên tên hàm `getLocalOrders` để không phải sửa lại các nơi gọi bên dưới.
async function getLocalOrders() {
  const res = await fetch(`${API_BASE_URL}/orders`, { headers: { "X-Admin-Token": adminToken() } });
  if (!res.ok) throw new Error("Không tải được danh sách đơn hàng từ máy chủ.");
  return res.json();
}
async function updateOrderRemote(id, fields) {
  const res = await fetch(`${API_BASE_URL}/orders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken() },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error("Cập nhật đơn hàng thất bại.");
  return res.json();
}
// Dùng chung cho khách đặt (checkout.js POST trực tiếp) và admin tạo tay
// (qua hàm này) — server tự sinh mã đơn + tự tính lại giá/tồn kho.
async function createOrderRemote(orderRequest) {
  const res = await fetch(`${API_BASE_URL}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderRequest),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Tạo đơn hàng thất bại.");
  invalidateProductsCache(); // đơn hàng đã trừ kho trên server — cache cũ sẽ sai tồn kho
  return data;
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
    sessionStorage.setItem(ADMIN_TOKEN_SESSION_KEY, ADMIN_TOKEN);
    unlockAdmin();
  } else {
    document.getElementById("adminLoginError").style.display = "block";
    document.getElementById("adminLoginError").textContent = "Sai mật khẩu quản trị.";
  }
});
document.getElementById("adminLogoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  sessionStorage.removeItem(ADMIN_TOKEN_SESSION_KEY);
  location.reload();
});

// ===== HELPERS =====
function slugify(name) {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now().toString().slice(-4);
}

// ===== TAB SWITCHING =====
const TAB_TITLES = {
  products: "Sản phẩm", categories: "Danh mục", combos: "Combo", orders: "Đơn hàng", customers: "Khách hàng",
  stock: "Xuất nhập tồn", production: "Sản xuất & giao hàng", hr: "Nhân sự & chấm công",
  ingredients: "Nguyên liệu", recipes: "Công thức pha chế",
  "pricing-calc": "Bảng tính giá bán", breakeven: "Điểm hoà vốn", finance: "Tài chính", "about-system": "Về hệ thống",
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
  if (tab === "stock") renderStockTab();
  if (tab === "production") renderProductionTab();
  if (tab === "hr") renderHrTab();
  if (tab === "ingredients") renderIngredientsTab();
  if (tab === "recipes") renderRecipesTab();
  if (tab === "pricing-calc") renderPricingCalcTab();
  if (tab === "breakeven") recalcBreakeven();
  if (tab === "finance") renderFinanceTab();
  const toolbarTabs = ["ingredients", "recipes", "stock", "production", "hr", "finance"];
  document.getElementById("dataToolbar").style.display = toolbarTabs.includes(tab) ? "flex" : "none";
}
document.querySelectorAll(".sidebar-link[data-tab]").forEach(btn => {
  btn.addEventListener("click", () => {
    switchTab(btn.dataset.tab, btn.dataset.cat);
  });
});

// ===== TAB: SẢN PHẨM =====
async function renderProductsTab() {
  const products = await loadProducts();
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
  document.querySelectorAll("[data-toggle]").forEach(b => b.addEventListener("click", async () => {
    const p = await getProductById(b.dataset.toggle);
    await updateProductFields(p.id, { visible: !p.visible }, adminToken());
    renderProductsTab();
  }));
}

document.getElementById("addProductBtn").addEventListener("click", () => openProductModal(null));
async function openProductModal(id) {
  const p = id ? await getProductById(id) : null;
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
  document.getElementById("pf_stock").disabled = !!p; // sửa tồn kho phải qua tab Xuất nhập tồn
  document.getElementById("productModal").style.display = "flex";
  document.getElementById("productModalOverlay").classList.add("show");
}
function closeProductModal() {
  document.getElementById("productModal").style.display = "none";
  document.getElementById("productModalOverlay").classList.remove("show");
}
document.getElementById("productModalCancel").addEventListener("click", closeProductModal);
document.getElementById("productModalOverlay").addEventListener("click", closeProductModal);

document.getElementById("productForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("pf_id").value;
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
  };
  try {
    if (id) {
      await updateProductFields(id, data, adminToken()); // KHÔNG gửi stock — sửa ở tab Xuất nhập tồn
    } else {
      await createProduct({ ...data, stock: Number(document.getElementById("pf_stock").value), visible: true }, adminToken());
    }
  } catch (err) {
    alert(err.message);
    return;
  }
  closeProductModal();
  renderProductsTab();
});

// ===== TAB: DANH MỤC =====
async function renderCategoriesTab() {
  const categories = loadCategories();
  const products = await loadProducts();
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

async function comboLineCostLabel(row) {
  if (!row.product_id) return "—";
  const p = await getProductById(row.product_id);
  return p ? `${p.icon} ${p.name}` : "—";
}
async function renderComboItemsRows() {
  const products = await loadProducts();
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
async function openComboModal(id) {
  const c = id ? getComboById(id) : null;
  document.getElementById("comboModalTitle").textContent = c ? "Sửa combo" : "Tạo combo";
  document.getElementById("cb_id").value = c ? c.id : "";
  document.getElementById("cb_name").value = c ? c.name : "";
  document.getElementById("cb_tagline").value = c ? c.tagline : "";
  document.getElementById("cb_icon").value = c ? c.icon : "📦";
  document.getElementById("cb_image").value = c && c.image ? c.image : "";
  document.getElementById("cb_price_from").value = c && c.price_from ? c.price_from : "";
  comboItemsState = c ? c.items.map(it => ({ ...it })) : [];
  await renderComboItemsRows();
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
async function renderOrdersTab() {
  const orders = await getLocalOrders();
  document.getElementById("ordersTableBody").innerHTML = orders.length ? orders.map(o => `
    <tr>
      <td>${o.id}</td>
      <td>${new Date(o.createdAt).toLocaleString("vi-VN")}</td>
      <td>${o.customerName}${o.customerCompany ? " (" + o.customerCompany + ")" : ""}</td>
      <td>${o.customerPhone}</td>
      <td>${o.channel || "Website"}</td>
      <td>${o.totalKg}kg</td>
      <td>${money(o.total)}</td>
      <td>✅ Đã đồng bộ</td>
      <td>
        <select data-order-status="${o.id}">
          ${ORDER_STATUSES.map(s => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="9" style="text-align:center;color:var(--muted);">Chưa có đơn hàng nào.</td></tr>`;

  document.querySelectorAll("[data-order-status]").forEach(sel => {
    sel.addEventListener("change", async () => {
      await updateOrderRemote(sel.dataset.orderStatus, { status: sel.value });
    });
  });
}

// ----- Modal tạo đơn hàng thủ công (khách gọi điện/Zalo/tại quầy) -----
async function renderOrderItemsRows() {
  const products = await loadProducts();
  const cart = {};
  orderItemsState.forEach(row => {
    if (row.product_id && row.qty > 0) cart[row.product_id] = (cart[row.product_id] || 0) + row.qty;
  });
  const lines = await buildCartLines(cart);
  const lineByProduct = new Map(lines.map(l => [l.id, l]));

  const body = document.getElementById("orderItemsBody");
  body.innerHTML = orderItemsState.length ? orderItemsState.map((row, idx) => {
    const line = row.product_id ? lineByProduct.get(row.product_id) : null;
    return `
    <tr>
      <td>
        <select data-row-product="${idx}">
          <option value="">— Chọn sản phẩm —</option>
          ${products.map(p => `<option value="${p.id}" ${p.id === row.product_id ? "selected" : ""}>${p.name} (tồn ${p.stock}${p.unit})</option>`).join("")}
        </select>
      </td>
      <td><input type="number" min="0" step="1" data-row-qty="${idx}" value="${row.qty}" style="width:80px;"></td>
      <td>${line ? money(line.unitPrice) + (line.isWholesale ? " (sỉ)" : "") : "—"}</td>
      <td>${line ? money(line.lineTotal) : "—"}</td>
      <td><button type="button" class="btn secondary sm" data-row-remove="${idx}">Xoá</button></td>
    </tr>`;
  }).join("") : `<tr><td colspan="5" style="text-align:center;color:var(--muted);">Chưa có sản phẩm nào.</td></tr>`;

  body.querySelectorAll("[data-row-product]").forEach(sel => sel.addEventListener("change", () => {
    orderItemsState[Number(sel.dataset.rowProduct)].product_id = sel.value;
    renderOrderItemsRows();
  }));
  body.querySelectorAll("[data-row-qty]").forEach(inp => inp.addEventListener("input", () => {
    orderItemsState[Number(inp.dataset.rowQty)].qty = Number(inp.value) || 0;
    renderOrderItemsRows();
  }));
  body.querySelectorAll("[data-row-remove]").forEach(btn => btn.addEventListener("click", () => {
    orderItemsState.splice(Number(btn.dataset.rowRemove), 1);
    renderOrderItemsRows();
  }));

  document.getElementById("orderTotalKg").textContent = getCartTotalKg(cart) + "kg";
  document.getElementById("orderTotalMoney").textContent = money(await getCartTotal(cart));
}
document.getElementById("addOrderItemRowBtn").addEventListener("click", () => {
  orderItemsState.push({ product_id: "", qty: 1 });
  renderOrderItemsRows();
});

document.getElementById("addOrderBtn").addEventListener("click", async () => {
  document.getElementById("orderForm").reset();
  orderItemsState = [];
  await renderOrderItemsRows();
  document.getElementById("orderModal").style.display = "flex";
  document.getElementById("orderModalOverlay").classList.add("show");
});
function closeOrderModal() {
  document.getElementById("orderModal").style.display = "none";
  document.getElementById("orderModalOverlay").classList.remove("show");
}
document.getElementById("orderModalCancel").addEventListener("click", closeOrderModal);
document.getElementById("orderModalOverlay").addEventListener("click", closeOrderModal);

document.getElementById("orderForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const cart = {};
  orderItemsState.forEach(row => {
    if (row.product_id && row.qty > 0) cart[row.product_id] = (cart[row.product_id] || 0) + row.qty;
  });
  const lines = await buildCartLines(cart);
  if (!lines.length) { alert("Chưa chọn sản phẩm nào."); return; }

  // Server (Worker) tự sinh mã đơn, tự tính lại giá/tồn kho và tự trừ kho —
  // không tự tính/tự trừ ở đây nữa, tránh lệch với dữ liệu thật trên server.
  const orderRequest = {
    createdAt: new Date().toISOString(),
    customerName: document.getElementById("of_name").value.trim(),
    customerPhone: document.getElementById("of_phone").value.trim(),
    customerCompany: document.getElementById("of_company").value.trim(),
    address: document.getElementById("of_address").value.trim(),
    province: document.getElementById("of_province").value.trim(),
    note: document.getElementById("of_note").value.trim(),
    lines: lines.map(l => ({ productId: l.id, qty: l.qty })),
    delivery_status: "Chưa giao", delivery_date_planned: "", delivery_date_actual: "", shipper_name: "",
    channel: "Tạo tay (admin)",
  };

  let order;
  try {
    order = await createOrderRemote(orderRequest);
  } catch (err) {
    alert(err.message);
    return;
  }
  upsertCustomerFromOrder(order);

  closeOrderModal();
  renderOrdersTab();
});

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

// ===== TAB: XUẤT NHẬP TỒN =====
const DELIVERY_STATUSES = ["Chưa giao", "Đang giao", "Đã giao", "Giao thất bại"];

function defaultPeriod() {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: first.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
}

async function renderStockTab() {
  const fromEl = document.getElementById("stockPeriodFrom");
  const toEl = document.getElementById("stockPeriodTo");
  if (!fromEl.value || !toEl.value) {
    const d = defaultPeriod();
    fromEl.value = fromEl.value || d.from;
    toEl.value = toEl.value || d.to;
  }
  const ledger = await computeStockLedger(fromEl.value, toEl.value, adminToken());
  document.getElementById("stockLedgerBody").innerHTML = ledger.length ? ledger.map((row, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${row.name}${row.outOfStock ? ' <span class="status-badge" style="background:#fbe4e1;color:var(--danger);">HẾT</span>' : ""}</td>
      <td>${row.item_type === "ingredient" ? "Nguyên liệu" : "Sản phẩm"}</td>
      <td>${row.unit}</td>
      <td>${row.tonDauKy}</td>
      <td>${row.nhap}</td>
      <td>${row.xuat}</td>
      <td>${row.tonCuoiKyTinh}</td>
      <td>${row.tonThuc}</td>
    </tr>
  `).join("") : `<tr><td colspan="9" style="text-align:center;color:var(--muted);">Chưa có nguyên liệu/sản phẩm nào.</td></tr>`;

  const txList = await getAllStockTxHistory(adminToken());
  const sourceLabel = { manual: "Thủ công", order: "Đơn hàng", production: "Sản xuất" };
  document.getElementById("stockTxTableBody").innerHTML = txList.length ? txList.map(t => `
    <tr>
      <td>${t.id}</td>
      <td>${t.type === "nhap" ? "Nhập" : "Xuất"}</td>
      <td>${new Date(t.date).toLocaleDateString("vi-VN")}</td>
      <td>${t.item_name}</td>
      <td>${t.qty} ${t.unit}</td>
      <td>${t.note || "—"}</td>
      <td>${sourceLabel[t.source] || t.source}</td>
      <td>${t.source === "manual" ? `<button class="btn secondary sm" data-delete-stock-tx="${t.id}">Xoá</button>` : "—"}</td>
    </tr>
  `).join("") : `<tr><td colspan="8" style="text-align:center;color:var(--muted);">Chưa có phiếu nào.</td></tr>`;

  document.querySelectorAll("[data-delete-stock-tx]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Xoá phiếu này? Tồn kho sẽ được hoàn lại tương ứng.")) return;
    await deleteStockTx(b.dataset.deleteStockTx, adminToken());
    renderStockTab();
  }));
}
document.getElementById("stockPeriodFrom").addEventListener("change", renderStockTab);
document.getElementById("stockPeriodTo").addEventListener("change", renderStockTab);
document.getElementById("addStockInBtn").addEventListener("click", () => openStockTxModal("nhap"));
document.getElementById("addStockOutBtn").addEventListener("click", () => openStockTxModal("xuat"));

async function renderStockTxItemsRows() {
  const items = await getAllStockItems();
  const body = document.getElementById("stockTxItemsBody");
  body.innerHTML = stockTxItemsState.length ? stockTxItemsState.map((row, idx) => {
    const filtered = items.filter(i => i.item_type === row.item_type);
    return `
    <tr>
      <td>
        <select data-row-type="${idx}">
          <option value="ingredient" ${row.item_type === "ingredient" ? "selected" : ""}>Nguyên liệu</option>
          <option value="product" ${row.item_type === "product" ? "selected" : ""}>Sản phẩm</option>
        </select>
      </td>
      <td>
        <select data-row-item="${idx}">
          <option value="">— Chọn —</option>
          ${filtered.map(i => `<option value="${i.id}" ${i.id === row.item_id ? "selected" : ""}>${i.name} (${i.unit})</option>`).join("")}
        </select>
      </td>
      <td><input type="number" min="0" step="0.01" data-row-qty="${idx}" value="${row.qty}" style="width:90px;"></td>
      <td><button type="button" class="btn secondary sm" data-row-remove="${idx}">Xoá</button></td>
    </tr>
  `;
  }).join("") : `<tr><td colspan="4" style="text-align:center;color:var(--muted);">Chưa có dòng nào.</td></tr>`;

  body.querySelectorAll("[data-row-type]").forEach(sel => sel.addEventListener("change", () => {
    const idx = Number(sel.dataset.rowType);
    stockTxItemsState[idx].item_type = sel.value;
    stockTxItemsState[idx].item_id = "";
    renderStockTxItemsRows();
  }));
  body.querySelectorAll("[data-row-item]").forEach(sel => sel.addEventListener("change", () => {
    stockTxItemsState[Number(sel.dataset.rowItem)].item_id = sel.value;
  }));
  body.querySelectorAll("[data-row-qty]").forEach(inp => inp.addEventListener("input", () => {
    stockTxItemsState[Number(inp.dataset.rowQty)].qty = Number(inp.value) || 0;
  }));
  body.querySelectorAll("[data-row-remove]").forEach(btn => btn.addEventListener("click", () => {
    stockTxItemsState.splice(Number(btn.dataset.rowRemove), 1);
    renderStockTxItemsRows();
  }));
}
document.getElementById("addStockTxRowBtn").addEventListener("click", () => {
  stockTxItemsState.push({ item_type: "ingredient", item_id: "", qty: 0 });
  renderStockTxItemsRows();
});

async function openStockTxModal(type) {
  document.getElementById("stx_type").value = type;
  document.getElementById("stockTxModalTitle").textContent = type === "nhap" ? "Tạo phiếu nhập" : "Tạo phiếu xuất";
  document.getElementById("stx_date").value = new Date().toISOString().slice(0, 10);
  document.getElementById("stx_note").value = "";
  stockTxItemsState = [];
  await renderStockTxItemsRows();
  document.getElementById("stockTxModal").style.display = "flex";
  document.getElementById("stockTxModalOverlay").classList.add("show");
}
function closeStockTxModal() {
  document.getElementById("stockTxModal").style.display = "none";
  document.getElementById("stockTxModalOverlay").classList.remove("show");
}
document.getElementById("stockTxModalCancel").addEventListener("click", closeStockTxModal);
document.getElementById("stockTxModalOverlay").addEventListener("click", closeStockTxModal);

document.getElementById("stockTxForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const type = document.getElementById("stx_type").value;
  const date = document.getElementById("stx_date").value;
  const note = document.getElementById("stx_note").value.trim();
  const validRows = stockTxItemsState.filter(row => row.item_id && row.qty > 0);
  if (!validRows.length) { alert("Chưa có dòng hợp lệ nào."); return; }
  try {
    for (const row of validRows) {
      await adjustStock(row.item_type, row.item_id, type === "nhap" ? row.qty : -row.qty, { type, date, note, source: "manual" }, adminToken());
    }
  } catch (err) {
    alert(err.message);
    return;
  }
  closeStockTxModal();
  renderStockTab();
});

// ===== TAB: SẢN XUẤT & GIAO HÀNG =====
async function renderProductionTab() {
  const batches = loadProduction();
  document.getElementById("productionTableBody").innerHTML = batches.length ? batches.map(b => `
    <tr>
      <td>${b.id}</td>
      <td>${new Date(b.date).toLocaleDateString("vi-VN")}</td>
      <td>${b.product_name}</td>
      <td>${b.output_qty}</td>
      <td>${b.inputs.map(it => `${it.ingredient_name} (${it.qty})`).join(", ")}</td>
      <td>${b.note || "—"}</td>
      <td><button class="btn secondary sm" data-delete-production="${b.id}">Xoá</button></td>
    </tr>
  `).join("") : `<tr><td colspan="7" style="text-align:center;color:var(--muted);">Chưa có mẻ sản xuất nào.</td></tr>`;

  document.querySelectorAll("[data-delete-production]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Xoá mẻ sản xuất này? Tồn kho nguyên liệu/sản phẩm sẽ được hoàn lại tương ứng.")) return;
    await deleteProductionBatch(b.dataset.deleteProduction, adminToken());
    renderProductionTab();
  }));

  const orders = await getLocalOrders();
  document.getElementById("deliveryTableBody").innerHTML = orders.length ? orders.map(o => `
    <tr>
      <td>${o.id}</td>
      <td>${o.customerName}</td>
      <td>${o.address}, ${o.province}</td>
      <td>
        <select data-delivery-status="${o.id}">
          ${DELIVERY_STATUSES.map(s => `<option value="${s}" ${s === (o.delivery_status || "Chưa giao") ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </td>
      <td><input type="date" data-delivery-date="${o.id}" value="${o.delivery_date_planned || ""}" style="padding:6px 8px;border:1px solid var(--cream-dark);border-radius:8px;"></td>
      <td><input type="text" data-delivery-shipper="${o.id}" value="${o.shipper_name || ""}" placeholder="Tên người giao" style="padding:6px 8px;border:1px solid var(--cream-dark);border-radius:8px;width:120px;"></td>
    </tr>
  `).join("") : `<tr><td colspan="6" style="text-align:center;color:var(--muted);">Chưa có đơn hàng nào.</td></tr>`;

  document.querySelectorAll("[data-delivery-status]").forEach(sel => sel.addEventListener("change", async () => {
    await updateOrderRemote(sel.dataset.deliveryStatus, { delivery_status: sel.value });
  }));
  document.querySelectorAll("[data-delivery-date]").forEach(inp => inp.addEventListener("change", async () => {
    await updateOrderRemote(inp.dataset.deliveryDate, { delivery_date_planned: inp.value });
  }));
  document.querySelectorAll("[data-delivery-shipper]").forEach(inp => inp.addEventListener("change", async () => {
    await updateOrderRemote(inp.dataset.deliveryShipper, { shipper_name: inp.value });
  }));
}

function renderProductionItemsRows() {
  const ingredients = loadIngredients();
  const body = document.getElementById("productionItemsBody");
  body.innerHTML = productionInputsState.length ? productionInputsState.map((row, idx) => `
    <tr>
      <td>
        <select data-row-ingredient="${idx}">
          <option value="">— Chọn nguyên liệu —</option>
          ${ingredients.map(i => `<option value="${i.id}" ${i.id === row.ingredient_id ? "selected" : ""}>${i.name} (tồn ${i.stock} ${i.unit})</option>`).join("")}
        </select>
      </td>
      <td><input type="number" min="0" step="0.01" data-row-qty="${idx}" value="${row.qty}" style="width:90px;"></td>
      <td><button type="button" class="btn secondary sm" data-row-remove="${idx}">Xoá</button></td>
    </tr>
  `).join("") : `<tr><td colspan="3" style="text-align:center;color:var(--muted);">Chưa có nguyên liệu nào.</td></tr>`;

  body.querySelectorAll("[data-row-ingredient]").forEach(sel => sel.addEventListener("change", () => {
    productionInputsState[Number(sel.dataset.rowIngredient)].ingredient_id = sel.value;
  }));
  body.querySelectorAll("[data-row-qty]").forEach(inp => inp.addEventListener("input", () => {
    productionInputsState[Number(inp.dataset.rowQty)].qty = Number(inp.value) || 0;
  }));
  body.querySelectorAll("[data-row-remove]").forEach(btn => btn.addEventListener("click", () => {
    productionInputsState.splice(Number(btn.dataset.rowRemove), 1);
    renderProductionItemsRows();
  }));
}
document.getElementById("addProductionRowBtn").addEventListener("click", () => {
  productionInputsState.push({ ingredient_id: "", qty: 0 });
  renderProductionItemsRows();
});

document.getElementById("addProductionBtn").addEventListener("click", async () => {
  document.getElementById("pdf_date").value = new Date().toISOString().slice(0, 10);
  const products = await loadProducts();
  document.getElementById("pdf_product_id").innerHTML = products.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
  document.getElementById("pdf_output_qty").value = "";
  document.getElementById("pdf_note").value = "";
  productionInputsState = [];
  renderProductionItemsRows();
  document.getElementById("productionModal").style.display = "flex";
  document.getElementById("productionModalOverlay").classList.add("show");
});
function closeProductionModal() {
  document.getElementById("productionModal").style.display = "none";
  document.getElementById("productionModalOverlay").classList.remove("show");
}
document.getElementById("productionModalCancel").addEventListener("click", closeProductionModal);
document.getElementById("productionModalOverlay").addEventListener("click", closeProductionModal);

document.getElementById("productionForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  let batch;
  try {
    batch = await createProductionBatch({
      date: document.getElementById("pdf_date").value,
      product_id: document.getElementById("pdf_product_id").value,
      output_qty: Number(document.getElementById("pdf_output_qty").value),
      note: document.getElementById("pdf_note").value.trim(),
      inputs: productionInputsState,
    }, adminToken());
  } catch (err) {
    alert(err.message);
    return;
  }
  if (!batch) { alert("Vui lòng chọn sản phẩm, số lượng đầu ra và ít nhất 1 nguyên liệu hợp lệ."); return; }
  closeProductionModal();
  renderProductionTab();
});

// ===== TAB: NHÂN SỰ & CHẤM CÔNG =====
function renderHrTab() {
  const employees = loadEmployees();
  document.getElementById("employeesTableBody").innerHTML = employees.length ? employees.map(emp => `
    <tr>
      <td>${emp.name}</td>
      <td>${emp.phone || "—"}</td>
      <td>${emp.role || "—"}</td>
      <td>${money(emp.daily_rate)}</td>
      <td>${emp.start_date || "—"}</td>
      <td><span class="status-badge ${emp.active ? "visible" : "hidden"}">${emp.active ? "Đang làm" : "Đã nghỉ"}</span></td>
      <td style="display:flex;gap:6px;">
        <button class="btn secondary sm" data-edit-employee="${emp.id}">Sửa</button>
        <button class="btn secondary sm" data-delete-employee="${emp.id}">Xoá</button>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="7" style="text-align:center;color:var(--muted);">Chưa có nhân viên nào.</td></tr>`;

  document.querySelectorAll("[data-edit-employee]").forEach(b => b.addEventListener("click", () => openEmployeeModal(b.dataset.editEmployee)));
  document.querySelectorAll("[data-delete-employee]").forEach(b => b.addEventListener("click", () => {
    if (!confirm("Xoá nhân viên này?")) return;
    saveEmployees(loadEmployees().filter(x => x.id !== b.dataset.deleteEmployee));
    renderHrTab();
  }));

  const monthEl = document.getElementById("attendanceMonth");
  if (!monthEl.value) monthEl.value = new Date().toISOString().slice(0, 7);
  const month = monthEl.value;

  const records = loadAttendance().filter(r => r.date.startsWith(month));
  document.getElementById("attendanceTableBody").innerHTML = records.length ? records.map(r => {
    const emp = getEmployeeById(r.employee_id);
    return `
    <tr>
      <td>${emp ? emp.name : "(đã xoá)"}</td>
      <td>${new Date(r.date).toLocaleDateString("vi-VN")}</td>
      <td>${r.cong}</td>
      <td>${r.note || "—"}</td>
      <td><button class="btn secondary sm" data-delete-attendance="${r.id}">Xoá</button></td>
    </tr>
  `;
  }).join("") : `<tr><td colspan="5" style="text-align:center;color:var(--muted);">Chưa có chấm công trong tháng này.</td></tr>`;

  document.querySelectorAll("[data-delete-attendance]").forEach(b => b.addEventListener("click", () => {
    saveAttendance(loadAttendance().filter(x => x.id !== b.dataset.deleteAttendance));
    renderHrTab();
  }));

  const summary = getMonthlyAttendanceSummary(month);
  document.getElementById("attendanceSummaryBody").innerHTML = summary.length ? summary.map(s => `
    <tr><td>${s.employee_name}</td><td>${s.totalCong}</td><td>${money(s.estimatedPay)}</td></tr>
  `).join("") : `<tr><td colspan="3" style="text-align:center;color:var(--muted);">Chưa có dữ liệu.</td></tr>`;
}
document.getElementById("attendanceMonth").addEventListener("change", renderHrTab);

document.getElementById("addEmployeeBtn").addEventListener("click", () => openEmployeeModal(null));
function openEmployeeModal(id) {
  const emp = id ? getEmployeeById(id) : null;
  document.getElementById("employeeModalTitle").textContent = emp ? "Sửa nhân viên" : "Thêm nhân viên";
  document.getElementById("ef_id").value = emp ? emp.id : "";
  document.getElementById("ef_name").value = emp ? emp.name : "";
  document.getElementById("ef_phone").value = emp ? emp.phone : "";
  document.getElementById("ef_role").value = emp ? emp.role : "";
  document.getElementById("ef_daily_rate").value = emp ? emp.daily_rate : "";
  document.getElementById("ef_start_date").value = emp ? emp.start_date : "";
  document.getElementById("ef_active").checked = emp ? emp.active : true;
  document.getElementById("employeeModal").style.display = "flex";
  document.getElementById("employeeModalOverlay").classList.add("show");
}
function closeEmployeeModal() {
  document.getElementById("employeeModal").style.display = "none";
  document.getElementById("employeeModalOverlay").classList.remove("show");
}
document.getElementById("employeeModalCancel").addEventListener("click", closeEmployeeModal);
document.getElementById("employeeModalOverlay").addEventListener("click", closeEmployeeModal);

document.getElementById("employeeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("ef_id").value;
  const list = loadEmployees();
  const data = {
    name: document.getElementById("ef_name").value.trim(),
    phone: document.getElementById("ef_phone").value.trim(),
    role: document.getElementById("ef_role").value.trim(),
    daily_rate: Number(document.getElementById("ef_daily_rate").value),
    start_date: document.getElementById("ef_start_date").value,
    active: document.getElementById("ef_active").checked,
  };
  if (id) {
    Object.assign(list.find(x => x.id === id), data);
  } else {
    list.push({ id: slugify(data.name), ...data });
  }
  saveEmployees(list);
  closeEmployeeModal();
  renderHrTab();
});

document.getElementById("addAttendanceBtn").addEventListener("click", () => {
  document.getElementById("atf_employee_id").innerHTML = loadEmployees().map(e => `<option value="${e.id}">${e.name}</option>`).join("");
  document.getElementById("atf_date").value = new Date().toISOString().slice(0, 10);
  document.getElementById("atf_cong").value = "1";
  document.getElementById("atf_note").value = "";
  document.getElementById("attendanceModal").style.display = "flex";
  document.getElementById("attendanceModalOverlay").classList.add("show");
});
function closeAttendanceModal() {
  document.getElementById("attendanceModal").style.display = "none";
  document.getElementById("attendanceModalOverlay").classList.remove("show");
}
document.getElementById("attendanceModalCancel").addEventListener("click", closeAttendanceModal);
document.getElementById("attendanceModalOverlay").addEventListener("click", closeAttendanceModal);

document.getElementById("attendanceForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const employeeId = document.getElementById("atf_employee_id").value;
  if (!employeeId) { alert("Chưa có nhân viên nào — thêm nhân viên trước."); return; }
  const list = loadAttendance();
  list.unshift({
    id: "cc-" + Date.now().toString().slice(-6),
    employee_id: employeeId,
    date: document.getElementById("atf_date").value,
    cong: Number(document.getElementById("atf_cong").value),
    note: document.getElementById("atf_note").value.trim(),
  });
  saveAttendance(list);
  closeAttendanceModal();
  renderHrTab();
});

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

// ===== TAB: TÀI CHÍNH =====
function renderFinanceTab() {
  const fromEl = document.getElementById("financePeriodFrom");
  const toEl = document.getElementById("financePeriodTo");
  if (!fromEl.value || !toEl.value) {
    const d = defaultPeriod();
    fromEl.value = fromEl.value || d.from;
    toEl.value = toEl.value || d.to;
  }
  const { totalThu, totalChi, profit, transactions } = summarizeFinance(fromEl.value, toEl.value);
  document.getElementById("finance_out_thu").textContent = money(totalThu);
  document.getElementById("finance_out_chi").textContent = money(totalChi);
  document.getElementById("finance_out_profit").textContent = money(profit);

  document.getElementById("financeTableBody").innerHTML = transactions.length ? transactions.map(t => `
    <tr>
      <td>${t.id}</td>
      <td>${new Date(t.date).toLocaleDateString("vi-VN")}</td>
      <td>${t.type === "thu" ? "Thu" : "Chi"}</td>
      <td>${t.category}</td>
      <td>${money(t.amount)}</td>
      <td>${t.note || "—"}</td>
      <td style="display:flex;gap:6px;">
        <button class="btn secondary sm" data-edit-finance="${t.id}">Sửa</button>
        <button class="btn secondary sm" data-delete-finance="${t.id}">Xoá</button>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="7" style="text-align:center;color:var(--muted);">Chưa có giao dịch nào trong kỳ.</td></tr>`;

  document.querySelectorAll("[data-edit-finance]").forEach(b => b.addEventListener("click", () => openFinanceModal(b.dataset.editFinance)));
  document.querySelectorAll("[data-delete-finance]").forEach(b => b.addEventListener("click", () => {
    if (!confirm("Xoá giao dịch này?")) return;
    saveFinance(loadFinance().filter(x => x.id !== b.dataset.deleteFinance));
    renderFinanceTab();
  }));
}
document.getElementById("financePeriodFrom").addEventListener("change", renderFinanceTab);
document.getElementById("financePeriodTo").addEventListener("change", renderFinanceTab);

document.getElementById("ff_type").addEventListener("change", updateFinanceCategoryList);
function updateFinanceCategoryList() {
  const type = document.getElementById("ff_type").value;
  document.getElementById("financeCategoryList").innerHTML = FINANCE_CATEGORY_SUGGESTIONS[type].map(c => `<option value="${c}"></option>`).join("");
}

document.getElementById("addFinanceBtn").addEventListener("click", () => openFinanceModal(null));
function openFinanceModal(id) {
  const t = id ? loadFinance().find(x => x.id === id) : null;
  document.getElementById("financeModalTitle").textContent = t ? "Sửa giao dịch" : "Thêm giao dịch";
  document.getElementById("ff_id").value = t ? t.id : "";
  document.getElementById("ff_type").value = t ? t.type : "thu";
  document.getElementById("ff_date").value = t ? t.date : new Date().toISOString().slice(0, 10);
  document.getElementById("ff_category").value = t ? t.category : "";
  document.getElementById("ff_amount").value = t ? t.amount : "";
  document.getElementById("ff_note").value = t ? t.note : "";
  updateFinanceCategoryList();
  document.getElementById("financeModal").style.display = "flex";
  document.getElementById("financeModalOverlay").classList.add("show");
}
function closeFinanceModal() {
  document.getElementById("financeModal").style.display = "none";
  document.getElementById("financeModalOverlay").classList.remove("show");
}
document.getElementById("financeModalCancel").addEventListener("click", closeFinanceModal);
document.getElementById("financeModalOverlay").addEventListener("click", closeFinanceModal);

document.getElementById("financeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = document.getElementById("ff_id").value;
  const list = loadFinance();
  const data = {
    type: document.getElementById("ff_type").value,
    date: document.getElementById("ff_date").value,
    category: document.getElementById("ff_category").value.trim(),
    amount: Number(document.getElementById("ff_amount").value),
    note: document.getElementById("ff_note").value.trim(),
  };
  if (id) {
    Object.assign(list.find(x => x.id === id), data);
  } else {
    list.push({ id: nextFinanceId(), ...data });
  }
  saveFinance(list);
  closeFinanceModal();
  renderFinanceTab();
});

// ===== TOOLBAR DỮ LIỆU: In/PDF, Lưu vào file, Nạp từ file khác, Khôi phục gốc, Bản gốc =====
document.getElementById("btnPrint").addEventListener("click", () => window.print());

document.getElementById("btnExport").addEventListener("click", () => {
  const data = {
    ingredients: loadIngredients(), recipes: loadRecipes(),
    stockTx: loadStockTx(), production: loadProduction(),
    employees: loadEmployees(), attendance: loadAttendance(), finance: loadFinance(),
    exportedAt: new Date().toISOString(),
  };
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
    if (!confirm(`Nạp file này sẽ THAY THẾ toàn bộ dữ liệu Nguyên liệu, Công thức, Xuất nhập tồn, Sản xuất, Nhân sự/Chấm công và Tài chính hiện có. Tiếp tục?`)) {
      e.target.value = "";
      return;
    }
    saveIngredients(data.ingredients);
    saveRecipes(data.recipes);
    if (Array.isArray(data.stockTx)) saveStockTx(data.stockTx);
    if (Array.isArray(data.production)) saveProduction(data.production);
    if (Array.isArray(data.employees)) saveEmployees(data.employees);
    if (Array.isArray(data.attendance)) saveAttendance(data.attendance);
    if (Array.isArray(data.finance)) saveFinance(data.finance);
    selectedRecipeCategory = null;
    renderIngredientsTab();
    renderRecipesTab();
    e.target.value = "";
    alert("Đã nạp dữ liệu từ file thành công.");
  };
  reader.readAsText(file);
});

document.getElementById("btnResetData").addEventListener("click", () => {
  if (!confirm("Khôi phục gốc sẽ XOÁ TOÀN BỘ Nguyên liệu, Công thức, Xuất nhập tồn, Sản xuất, Nhân sự/Chấm công và Tài chính hiện có, đưa hệ thống về trạng thái ban đầu (rỗng). Nếu chưa lưu file backup, dữ liệu sẽ mất vĩnh viễn. Tiếp tục?")) return;
  saveIngredients([]);
  saveRecipes([]);
  saveStockTx([]);
  saveProduction([]);
  saveEmployees([]);
  saveAttendance([]);
  saveFinance([]);
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
