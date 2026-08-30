// ===== DỮ LIỆU SẢN PHẨM =====
const CATEGORIES = [
  { id: "phin", name: "Cà phê phin truyền thống" },
  { id: "may", name: "Cà phê pha máy" },
  { id: "xay", name: "Cà phê đá xay" },
  { id: "tra", name: "Trà trái cây" },
];

const PRODUCTS = [
  { id: "p1", cat: "phin", name: "Cà phê đen đá", desc: "Đậm đà, nguyên chất", price: 25000, icon: "☕", stock: 40 },
  { id: "p2", cat: "phin", name: "Cà phê nâu đá", desc: "Cà phê phin + sữa đặc", price: 29000, icon: "☕", stock: 40 },
  { id: "p3", cat: "phin", name: "Bạc xỉu", desc: "Nhiều sữa, ít cà phê, dịu ngọt", price: 32000, icon: "🥛", stock: 30 },
  { id: "p4", cat: "phin", name: "Cà phê muối", desc: "Vị mặn ngọt lạ miệng", price: 35000, icon: "☕", stock: 20 },
  { id: "p5", cat: "may", name: "Espresso", desc: "Chuẩn Ý, đậm vị", price: 35000, icon: "☕", stock: 25 },
  { id: "p6", cat: "may", name: "Americano", desc: "Espresso pha loãng, thanh nhẹ", price: 39000, icon: "☕", stock: 25 },
  { id: "p7", cat: "may", name: "Latte", desc: "Espresso hoà quyện sữa tươi", price: 45000, icon: "🥛", stock: 20 },
  { id: "p8", cat: "may", name: "Cappuccino", desc: "Lớp bọt sữa mịn béo", price: 45000, icon: "☕", stock: 20 },
  { id: "p9", cat: "may", name: "Mocha", desc: "Cà phê + socola quyến rũ", price: 49000, icon: "🍫", stock: 15 },
  { id: "p10", cat: "xay", name: "Frappuccino Cà phê", desc: "Đá xay mát lạnh vị cà phê", price: 49000, icon: "🥤", stock: 15 },
  { id: "p11", cat: "xay", name: "Frappuccino Socola", desc: "Đá xay socola béo ngậy", price: 52000, icon: "🥤", stock: 15 },
  { id: "p12", cat: "xay", name: "Cookie Cream Đá Xay", desc: "Vị bánh quy kem thơm ngon", price: 55000, icon: "🥤", stock: 10 },
  { id: "p13", cat: "tra", name: "Trà đào cam sả", desc: "Thanh mát, giải nhiệt", price: 39000, icon: "🍑", stock: 20 },
  { id: "p14", cat: "tra", name: "Trà vải", desc: "Ngọt thanh hương vải", price: 39000, icon: "🍵", stock: 20 },
];
const CAT_NAME = Object.fromEntries(CATEGORIES.map(c => [c.id, c.name]));

// ===== STOCK STORE (localStorage) =====
function loadStock() {
  const saved = JSON.parse(localStorage.getItem("tucaphe_stock") || "{}");
  const stock = {};
  PRODUCTS.forEach(p => { stock[p.id] = saved[p.id] !== undefined ? saved[p.id] : p.stock; });
  return stock;
}
let stock = loadStock();
function saveStock() { localStorage.setItem("tucaphe_stock", JSON.stringify(stock)); }
function getStock(id) { return stock[id] ?? 0; }

// ===== STATE =====
let cart = JSON.parse(localStorage.getItem("tucaphe_cart") || "{}"); // { productId: qty }
let currentCategory = "phin";
let currentStep = 1;
let lastOrder = null;

const money = (n) => n.toLocaleString("vi-VN") + "₫";
const saveCart = () => localStorage.setItem("tucaphe_cart", JSON.stringify(cart));

// ===== RENDER: CATEGORY TABS =====
function renderCategoryTabs() {
  const wrap = document.getElementById("categoryTabs");
  wrap.innerHTML = CATEGORIES.map(c =>
    `<button class="cat-btn ${c.id === currentCategory ? "active" : ""}" data-cat="${c.id}">${c.name}</button>`
  ).join("");
  wrap.querySelectorAll(".cat-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentCategory = btn.dataset.cat;
      renderCategoryTabs();
      renderProductGrid();
    });
  });
}

// ===== RENDER: PRODUCT GRID =====
function renderProductGrid() {
  const grid = document.getElementById("productGrid");
  const items = PRODUCTS.filter(p => p.cat === currentCategory);
  grid.innerHTML = items.map(p => {
    const available = getStock(p.id);
    const inCart = cart[p.id] || 0;
    const remaining = Math.max(0, available - inCart);
    const outOfStock = remaining <= 0;
    let badgeClass = "", badgeText = `Còn ${available}`;
    if (available <= 0) { badgeClass = "out"; badgeText = "Hết hàng"; }
    else if (available <= 5) { badgeClass = "low"; badgeText = `Sắp hết: ${available}`; }
    return `
    <div class="product-card ${outOfStock ? "out-of-stock" : ""}">
      <div class="product-thumb">${p.icon}</div>
      <div class="product-info">
        <span class="stock-badge ${badgeClass}">${badgeText}</span>
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.desc}</div>
        <div class="product-price">${money(p.price)}</div>
        <div class="qty-row">
          <div class="qty-control">
            <button data-act="dec" data-id="${p.id}" ${outOfStock ? "disabled" : ""}>−</button>
            <input type="text" readonly id="qty-${p.id}" value="1">
            <button data-act="inc" data-id="${p.id}" ${outOfStock ? "disabled" : ""}>+</button>
          </div>
          <button class="add-btn" data-add="${p.id}" ${outOfStock ? "disabled" : ""}>${outOfStock ? "Hết hàng" : "Thêm"}</button>
        </div>
      </div>
    </div>`;
  }).join("");

  grid.querySelectorAll("[data-act]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const input = document.getElementById(`qty-${id}`);
      const maxQty = Math.max(1, getStock(id) - (cart[id] || 0));
      let val = parseInt(input.value, 10) || 1;
      val = btn.dataset.act === "inc" ? Math.min(maxQty, val + 1) : Math.max(1, val - 1);
      input.value = val;
    });
  });

  grid.querySelectorAll("[data-add]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.add;
      const remaining = getStock(id) - (cart[id] || 0);
      if (remaining <= 0) return;
      const qtyToAdd = Math.min(remaining, parseInt(document.getElementById(`qty-${id}`).value, 10) || 1);
      cart[id] = (cart[id] || 0) + qtyToAdd;
      saveCart();
      updateCartCount();
      renderCartDrawer();
      renderProductGrid();
    });
  });
}

// ===== CART CALCULATIONS =====
function getCartLines() {
  return Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const p = PRODUCTS.find(pr => pr.id === id);
      return { ...p, qty, lineTotal: p.price * qty };
    });
}
function getCartTotal() {
  return getCartLines().reduce((sum, l) => sum + l.lineTotal, 0);
}
function getCartCount() {
  return Object.values(cart).reduce((s, q) => s + q, 0);
}

function updateCartCount() {
  document.getElementById("cartCount").textContent = getCartCount();
}

// ===== RENDER: CART SECTION (step 2) & DRAWER =====
function cartItemsHtml(lines) {
  if (lines.length === 0) return `<div class="empty-msg">Giỏ hàng đang trống. Hãy chọn món yêu thích của bạn!</div>`;
  return lines.map(l => `
    <div class="cart-item">
      <div class="cart-item-icon">${l.icon}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${l.name}</div>
        <div class="cart-item-price">${money(l.price)} × ${l.qty}</div>
      </div>
      <div class="cart-item-line-total">${money(l.lineTotal)}</div>
      <button class="remove-btn" data-remove="${l.id}" title="Xoá">🗑️</button>
    </div>
  `).join("");
}

function renderCartSection() {
  const lines = getCartLines();
  document.getElementById("cartItems").innerHTML = cartItemsHtml(lines);
  const total = getCartTotal();
  document.getElementById("cartSubtotal").textContent = money(total);
  document.getElementById("cartTotal").textContent = money(total);

  document.getElementById("cartItems").querySelectorAll("[data-remove]").forEach(btn => {
    btn.addEventListener("click", () => {
      delete cart[btn.dataset.remove];
      saveCart();
      updateCartCount();
      renderCartSection();
      renderCartDrawer();
    });
  });
}

function renderCartDrawer() {
  const lines = getCartLines();
  document.getElementById("drawerItems").innerHTML = cartItemsHtml(lines);
  document.getElementById("drawerTotal").textContent = money(getCartTotal());
  document.getElementById("drawerItems").querySelectorAll("[data-remove]").forEach(btn => {
    btn.addEventListener("click", () => {
      delete cart[btn.dataset.remove];
      saveCart();
      updateCartCount();
      renderCartDrawer();
      renderCartSection();
    });
  });
}

// ===== STEPPER / PANEL NAVIGATION =====
function goToStep(step) {
  currentStep = step;
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  const panelIds = { 1: "menuSection", 2: "cartSection", 3: "checkoutSection", 4: "confirmSection" };
  document.getElementById(panelIds[step]).classList.add("active");

  document.querySelectorAll(".step").forEach(s => {
    const n = parseInt(s.dataset.step, 10);
    s.classList.toggle("active", n === step);
    s.classList.toggle("completed", n < step);
  });

  if (step === 2) renderCartSection();
  if (step === 3) document.getElementById("checkoutTotal").textContent = money(getCartTotal());

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-goto]").forEach(btn => {
  btn.addEventListener("click", () => goToStep(parseInt(btn.dataset.goto, 10)));
});

document.getElementById("toCheckoutBtn").addEventListener("click", () => {
  if (getCartCount() === 0) {
    alert("Giỏ hàng đang trống, hãy chọn ít nhất một sản phẩm.");
    return;
  }
  goToStep(3);
});

// ===== CART DRAWER TOGGLE =====
const cartDrawer = document.getElementById("cartDrawer");
const overlay = document.getElementById("overlay");
function openDrawer() { renderCartDrawer(); cartDrawer.classList.add("open"); overlay.classList.add("show"); }
function closeDrawer() { cartDrawer.classList.remove("open"); overlay.classList.remove("show"); }
document.getElementById("cartToggle").addEventListener("click", openDrawer);
document.getElementById("closeDrawer").addEventListener("click", closeDrawer);
overlay.addEventListener("click", closeDrawer);
document.getElementById("drawerCheckoutBtn").addEventListener("click", () => {
  closeDrawer();
  goToStep(2);
});

// ===== CHECKOUT SUBMIT =====
document.getElementById("checkoutForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (getCartCount() === 0) {
    alert("Giỏ hàng đang trống.");
    goToStep(1);
    return;
  }
  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const address = document.getElementById("custAddress").value.trim();
  const note = document.getElementById("custNote").value.trim();
  const payment = document.querySelector('input[name="payment"]:checked').value;
  const paymentLabel = { cod: "Thanh toán khi nhận hàng (COD)", transfer: "Chuyển khoản ngân hàng", momo: "Ví MoMo" }[payment];

  const lines = getCartLines();
  const total = getCartTotal();
  const orderId = "TCF" + Date.now().toString().slice(-8);

  lastOrder = {
    id: orderId,
    name, phone, address, note, payment: paymentLabel,
    lines, total,
    createdAt: new Date().toISOString(),
    status: "placed",
  };

  // Trừ tồn kho theo số lượng đã đặt
  lines.forEach(l => { stock[l.id] = Math.max(0, getStock(l.id) - l.qty); });
  saveStock();
  renderStockTable();

  saveOrderToHistory(lastOrder);
  renderConfirmation(lastOrder);
  cart = {};
  saveCart();
  updateCartCount();
  renderProductGrid();
  goToStep(4);
  simulateOrderProgress(lastOrder.id);
});

// ===== CONFIRMATION RENDER =====
function renderConfirmation(order) {
  document.getElementById("orderId").textContent = order.id;
  document.getElementById("orderReceipt").innerHTML = `
    ${order.lines.map(l => `<div><span>${l.name} × ${l.qty}</span><span>${money(l.lineTotal)}</span></div>`).join("")}
    <div class="receipt-total"><span>Tổng cộng</span><span>${money(order.total)}</span></div>
    <div><span>Người nhận</span><span>${order.name}</span></div>
    <div><span>SĐT</span><span>${order.phone}</span></div>
    <div><span>Địa chỉ</span><span>${order.address}</span></div>
    <div><span>Thanh toán</span><span>${order.payment}</span></div>
  `;
  updateStatusTrack("placed");
}

const STATUS_FLOW = ["placed", "confirmed", "brewing", "delivering", "done"];
function updateStatusTrack(status) {
  const idx = STATUS_FLOW.indexOf(status);
  document.querySelectorAll("#orderStatusTrack .status-step").forEach(el => {
    const elIdx = STATUS_FLOW.indexOf(el.dataset.status);
    el.classList.remove("done", "current");
    if (elIdx < idx) el.classList.add("done");
    else if (elIdx === idx) el.classList.add(idx === STATUS_FLOW.length - 1 ? "done" : "current");
  });
}

function simulateOrderProgress(orderId) {
  let i = 0;
  const interval = setInterval(() => {
    i++;
    if (i >= STATUS_FLOW.length) { clearInterval(interval); return; }
    const status = STATUS_FLOW[i];
    updateStatusTrack(status);
    updateOrderStatusInHistory(orderId, status);
    if (lastOrder && lastOrder.id === orderId) lastOrder.status = status;
    renderHistory();
  }, 4000);
}

document.getElementById("newOrderBtn").addEventListener("click", () => goToStep(1));

// ===== ORDER HISTORY (localStorage) =====
function getHistory() {
  return JSON.parse(localStorage.getItem("tucaphe_orders") || "[]");
}
function saveOrderToHistory(order) {
  const history = getHistory();
  history.unshift(order);
  localStorage.setItem("tucaphe_orders", JSON.stringify(history.slice(0, 20)));
  renderHistory();
}
function updateOrderStatusInHistory(orderId, status) {
  const history = getHistory();
  const o = history.find(h => h.id === orderId);
  if (o) { o.status = status; localStorage.setItem("tucaphe_orders", JSON.stringify(history)); }
}
const STATUS_LABEL = {
  placed: "Đã đặt hàng", confirmed: "Đã xác nhận", brewing: "Đang pha chế",
  delivering: "Đang giao hàng", done: "Hoàn thành",
};
function renderHistory() {
  const history = getHistory();
  const list = document.getElementById("historyList");
  if (history.length === 0) {
    list.innerHTML = `<div class="empty-msg">Chưa có đơn hàng nào.</div>`;
    return;
  }
  list.innerHTML = history.map(o => `
    <div class="history-item">
      <span class="hid">#${o.id}</span>
      <span>${new Date(o.createdAt).toLocaleString("vi-VN")}</span>
      <span>${o.lines.length} món · ${money(o.total)}</span>
      <span class="history-badge">${STATUS_LABEL[o.status] || o.status}</span>
    </div>
  `).join("");
}

// ===== STOCK MODAL =====
function renderStockTable() {
  const body = document.getElementById("stockTableBody");
  body.innerHTML = PRODUCTS.map(p => {
    const qty = getStock(p.id);
    return `
    <tr>
      <td>${p.icon} ${p.name}</td>
      <td>${CAT_NAME[p.cat]}</td>
      <td>${money(p.price)}</td>
      <td>${qty <= 0 ? '<span class="stock-badge out">Hết hàng</span>' : qty <= 5 ? `<span class="stock-badge low">${qty}</span>` : qty}</td>
      <td>
        <div class="restock-control">
          <input type="number" min="1" value="10" id="restock-${p.id}">
          <button data-restock="${p.id}">Nhập kho</button>
        </div>
      </td>
    </tr>`;
  }).join("");

  body.querySelectorAll("[data-restock]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.restock;
      const amount = parseInt(document.getElementById(`restock-${id}`).value, 10) || 0;
      if (amount > 0) {
        stock[id] = getStock(id) + amount;
        saveStock();
        renderStockTable();
        renderProductGrid();
      }
    });
  });
}

const stockModal = document.getElementById("stockModal");
function openStockModal() { renderStockTable(); stockModal.classList.add("open"); overlay.classList.add("show"); }
function closeStockModal() { stockModal.classList.remove("open"); overlay.classList.remove("show"); }
document.getElementById("stockToggle").addEventListener("click", openStockModal);
document.getElementById("closeStockModal").addEventListener("click", closeStockModal);
overlay.addEventListener("click", closeStockModal);

// ===== INIT =====
function init() {
  renderCategoryTabs();
  renderProductGrid();
  updateCartCount();
  renderCartDrawer();
  renderHistory();
  renderStockTable();
  goToStep(1);
}
init();
