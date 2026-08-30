// ⚠️ Rào chắn demo — KHÔNG PHẢI bảo mật thật. Xem ghi chú trong admin/index.html.
const ADMIN_DEMO_PASSWORD = "tucaphe2026";
const ADMIN_SESSION_KEY = "tcp_admin_unlocked";
const ORDERS_LOG_KEY = "tcp_orders_local_v1";
const ORDER_STATUSES = ["Mới", "Đã xác nhận", "Đang chuẩn bị", "Đang giao", "Hoàn thành", "Đã hủy"];

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

// ===== TAB SWITCHING =====
const TAB_TITLES = { products: "Sản phẩm", orders: "Đơn hàng", customers: "Khách hàng" };
document.querySelectorAll(".sidebar-link[data-tab]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sidebar-link[data-tab]").forEach(b => b.classList.toggle("active", b === btn));
    ["products", "orders", "customers"].forEach(t => {
      document.getElementById("tab-" + t).style.display = t === btn.dataset.tab ? "block" : "none";
    });
    document.getElementById("adminBreadcrumb").textContent = TAB_TITLES[btn.dataset.tab];
    if (btn.dataset.tab === "orders") renderOrdersTab();
    if (btn.dataset.tab === "customers") renderCustomersTab();
  });
});

// ===== TAB: SẢN PHẨM =====
function renderProductsTab() {
  const products = loadProducts();
  document.getElementById("productsTableBody").innerHTML = products.map(p => `
    <tr>
      <td>${p.icon} ${p.name}</td>
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
  `).join("");

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
  document.getElementById("pf_name").value = p ? p.name : "";
  document.getElementById("pf_short_desc").value = p ? p.short_desc : "";
  document.getElementById("pf_description").value = p ? p.description : "";
  document.getElementById("pf_flavor").value = p ? p.flavor : "";
  document.getElementById("pf_roast").value = p ? p.roast : "";
  document.getElementById("pf_origin_type").value = p ? p.origin_type : "";
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
    name: document.getElementById("pf_name").value.trim(),
    short_desc: document.getElementById("pf_short_desc").value.trim(),
    description: document.getElementById("pf_description").value.trim(),
    flavor: document.getElementById("pf_flavor").value.trim(),
    roast: document.getElementById("pf_roast").value.trim(),
    origin_type: document.getElementById("pf_origin_type").value.trim(),
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
    const newId = data.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now().toString().slice(-4);
    list.push({ id: newId, icon: "☕", visible: true, ...data });
  }
  saveProducts(list);
  closeProductModal();
  renderProductsTab();
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
  const orders = getLocalOrders();
  const map = new Map();
  orders.forEach(o => {
    const key = o.customerPhone;
    if (!map.has(key)) map.set(key, { name: o.customerName, phone: o.customerPhone, company: o.customerCompany, count: 0 });
    map.get(key).count++;
  });
  const customers = [...map.values()];
  document.getElementById("customersTableBody").innerHTML = customers.length ? customers.map(c => `
    <tr><td>${c.name}</td><td>${c.phone}</td><td>${c.company || "—"}</td><td>${c.count}</td></tr>
  `).join("") : `<tr><td colspan="4" style="text-align:center;color:var(--muted);">Chưa có khách hàng nào.</td></tr>`;
}
