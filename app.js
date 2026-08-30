// ===== DỮ LIỆU SẢN PHẨM (CÀ PHÊ HẠT BÁN SỈ) =====
const CATEGORIES = [
  { id: "arabica", name: "Arabica" },
  { id: "robusta", name: "Robusta" },
  { id: "dacsan", name: "Hạt đặc sản" },
  { id: "blend", name: "Blend hỗn hợp" },
];

// price = giá / kg (VNĐ), stock = tồn kho (kg), minOrderKg = số kg tối thiểu / lần đặt
const PRODUCTS = [
  { id: "p1", cat: "arabica", name: "Arabica Cầu Đất", origin: "Đà Lạt", desc: "Rang vừa, vị chua thanh, hương hoa quả", price: 220000, icon: "☕", stock: 500, minOrderKg: 10 },
  { id: "p2", cat: "arabica", name: "Arabica Rang Mộc", origin: "Sơn La", desc: "Nguyên chất, phù hợp pha máy espresso", price: 230000, icon: "☕", stock: 250, minOrderKg: 10 },
  { id: "p3", cat: "robusta", name: "Robusta Buôn Ma Thuột", origin: "Đắk Lắk", desc: "Rang đậm, vị đắng mạnh, nhiều caffeine", price: 140000, icon: "🫘", stock: 800, minOrderKg: 20 },
  { id: "p4", cat: "robusta", name: "Robusta Rang Mộc", origin: "Đắk Nông", desc: "Nguyên chất, chuyên dùng pha phin", price: 135000, icon: "🫘", stock: 700, minOrderKg: 20 },
  { id: "p5", cat: "dacsan", name: "Culi Robusta", origin: "Đắk Lắk", desc: "Hạt tròn đặc biệt, đậm đà hiếm có", price: 160000, icon: "🌰", stock: 300, minOrderKg: 10 },
  { id: "p6", cat: "dacsan", name: "Moka Cầu Đất", origin: "Đà Lạt", desc: "Hương thơm đặc trưng, sản lượng thấp", price: 350000, icon: "🌸", stock: 150, minOrderKg: 5 },
  { id: "p7", cat: "dacsan", name: "Cherry (Excelsa)", origin: "Quảng Trị", desc: "Vị chua nhẹ, hậu vị trái cây", price: 130000, icon: "🍒", stock: 200, minOrderKg: 10 },
  { id: "p8", cat: "blend", name: "Blend 4 Loại Hạt", origin: "Hỗn hợp", desc: "Arabica, Robusta, Culi, Cherry cân bằng", price: 180000, icon: "🥣", stock: 600, minOrderKg: 20 },
  { id: "p9", cat: "blend", name: "Blend Espresso Ý", origin: "Hỗn hợp", desc: "Công thức rang đậm chuẩn quán cà phê", price: 195000, icon: "🥣", stock: 400, minOrderKg: 20 },
];
const CAT_NAME = Object.fromEntries(CATEGORIES.map(c => [c.id, c.name]));

// Chiết khấu sỉ theo sản lượng đặt của MỖI sản phẩm
const TIERS = [
  { minKg: 100, rate: 0.10 },
  { minKg: 50, rate: 0.05 },
];
function tierRateFor(qtyKg) {
  const tier = TIERS.find(t => qtyKg >= t.minKg);
  return tier ? tier.rate : 0;
}

// ===== STOCK STORE (localStorage) =====
function loadStock() {
  const saved = JSON.parse(localStorage.getItem("tucaphe_stock_b2b") || "{}");
  const stock = {};
  PRODUCTS.forEach(p => { stock[p.id] = saved[p.id] !== undefined ? saved[p.id] : p.stock; });
  return stock;
}
let stock = loadStock();
function saveStock() { localStorage.setItem("tucaphe_stock_b2b", JSON.stringify(stock)); }
function getStock(id) { return stock[id] ?? 0; }

// ===== STATE =====
let cart = JSON.parse(localStorage.getItem("tucaphe_cart_b2b") || "{}"); // { productId: qtyKg }
let currentCategory = "arabica";
let currentStep = 1;
let lastOrder = null;

const money = (n) => Math.round(n).toLocaleString("vi-VN") + "₫";
const saveCart = () => localStorage.setItem("tucaphe_cart_b2b", JSON.stringify(cart));

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

// ===== RENDER: QUICK ORDER BAR (chọn loại hạt) =====
function renderQuickBar() {
  const sel = document.getElementById("quickCat");
  sel.innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
  sel.value = currentCategory;
  sel.addEventListener("change", () => {
    currentCategory = sel.value;
    renderCategoryTabs();
    renderProductGrid();
  });
  document.getElementById("quickFindBtn").addEventListener("click", () => {
    currentCategory = sel.value;
    renderCategoryTabs();
    renderProductGrid();
    document.getElementById("productGrid").scrollIntoView({ behavior: "smooth", block: "start" });
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
    let badgeClass = "", badgeText = `Còn ${available}kg`;
    if (available <= 0) { badgeClass = "out"; badgeText = "Hết hàng"; }
    else if (available <= p.minOrderKg * 2) { badgeClass = "low"; badgeText = `Sắp hết: ${available}kg`; }
    const defaultQty = Math.min(p.minOrderKg, Math.max(1, remaining));
    return `
    <div class="product-card ${outOfStock ? "out-of-stock" : ""}">
      <div class="product-thumb">
        <span class="origin-badge">📍 ${p.origin}</span>
        ${p.icon}
      </div>
      <div class="product-info">
        <span class="stock-badge ${badgeClass}">${badgeText}</span>
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.desc}</div>
        <div class="min-order">Đặt tối thiểu ${p.minOrderKg}kg / lần</div>
        <div class="product-price">${money(p.price)} <small>/ kg</small></div>
        <div class="qty-row">
          <div class="qty-control">
            <button data-act="dec" data-id="${p.id}" ${outOfStock ? "disabled" : ""}>−</button>
            <input type="text" readonly id="qty-${p.id}" value="${defaultQty}">
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
      const p = PRODUCTS.find(pr => pr.id === id);
      const input = document.getElementById(`qty-${id}`);
      const maxQty = Math.max(p.minOrderKg, getStock(id) - (cart[id] || 0));
      let val = parseInt(input.value, 10) || p.minOrderKg;
      val = btn.dataset.act === "inc" ? Math.min(maxQty, val + p.minOrderKg) : Math.max(p.minOrderKg, val - p.minOrderKg);
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
      const rate = tierRateFor(qty);
      const base = p.price * qty;
      const discount = base * rate;
      return { ...p, qty, rate, base, discount, lineTotal: base - discount };
    });
}
function getCartSubtotal() { return getCartLines().reduce((s, l) => s + l.base, 0); }
function getCartDiscountTotal() { return getCartLines().reduce((s, l) => s + l.discount, 0); }
function getCartTotal() { return getCartLines().reduce((sum, l) => sum + l.lineTotal, 0); }
function getCartCount() { return Object.values(cart).reduce((s, q) => s + q, 0); }

function updateCartCount() {
  document.getElementById("cartCount").textContent = getCartCount() + "kg";
}

// ===== RENDER: CART SECTION (step 2) & DRAWER =====
function cartItemsHtml(lines) {
  if (lines.length === 0) return `<div class="empty-msg">Giỏ hàng đang trống. Hãy chọn cà phê hạt cần đặt!</div>`;
  return lines.map(l => `
    <div class="cart-item">
      <div class="cart-item-icon">${l.icon}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${l.name}</div>
        <div class="cart-item-price">${money(l.price)}/kg × ${l.qty}kg</div>
        ${l.rate > 0 ? `<div class="cart-item-discount">Chiết khấu sỉ -${Math.round(l.rate * 100)}%</div>` : ""}
      </div>
      <div class="cart-item-line-total">${money(l.lineTotal)}</div>
      <button class="remove-btn" data-remove="${l.id}" title="Xoá">🗑️</button>
    </div>
  `).join("");
}

function renderCartSection() {
  const lines = getCartLines();
  document.getElementById("cartItems").innerHTML = cartItemsHtml(lines);
  document.getElementById("cartSubtotal").textContent = money(getCartSubtotal());
  document.getElementById("cartDiscount").textContent = "-" + money(getCartDiscountTotal());
  document.getElementById("cartTotal").textContent = money(getCartTotal());

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
  btn.addEventListener("click", (e) => { e.preventDefault(); goToStep(parseInt(btn.dataset.goto, 10)); });
});
document.getElementById("heroOrderBtn").addEventListener("click", () => {
  document.getElementById("productGrid").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.getElementById("toCheckoutBtn").addEventListener("click", () => {
  if (getCartCount() === 0) {
    alert("Giỏ hàng đang trống, hãy chọn ít nhất một sản phẩm.");
    return;
  }
  goToStep(3);
});

document.querySelector('[data-scroll="historySection"]').addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("historySection").scrollIntoView({ behavior: "smooth" });
});

// ===== CART DRAWER TOGGLE =====
const cartDrawer = document.getElementById("cartDrawer");
const overlay = document.getElementById("overlay");
function openDrawer() { renderCartDrawer(); cartDrawer.classList.add("open"); overlay.classList.add("show"); }
function closeDrawer() { cartDrawer.classList.remove("open"); overlay.classList.remove("show"); }
document.getElementById("cartToggle").addEventListener("click", openDrawer);
document.getElementById("closeDrawer").addEventListener("click", closeDrawer);
overlay.addEventListener("click", () => { closeDrawer(); closeStockModal(); });
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
  const company = document.getElementById("custCompany").value.trim();
  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const tax = document.getElementById("custTax").value.trim();
  const address = document.getElementById("custAddress").value.trim();
  const note = document.getElementById("custNote").value.trim();
  const payment = document.querySelector('input[name="payment"]:checked').value;
  const paymentLabel = { cod: "Thanh toán khi nhận hàng (COD)", transfer: "Chuyển khoản ngân hàng", debt: "Công nợ 30 ngày" }[payment];

  const lines = getCartLines();
  const subtotal = getCartSubtotal();
  const discount = getCartDiscountTotal();
  const total = getCartTotal();
  const orderId = "TCFB2B" + Date.now().toString().slice(-8);

  lastOrder = {
    id: orderId,
    company, name, phone, tax, address, note, payment: paymentLabel,
    lines, subtotal, discount, total,
    createdAt: new Date().toISOString(),
    status: "placed",
  };

  // Trừ tồn kho theo số kg đã đặt
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
    ${order.lines.map(l => `<div><span>${l.name} × ${l.qty}kg${l.rate > 0 ? ` (-${Math.round(l.rate * 100)}%)` : ""}</span><span>${money(l.lineTotal)}</span></div>`).join("")}
    <div><span>Tạm tính</span><span>${money(order.subtotal)}</span></div>
    <div><span>Chiết khấu sỉ</span><span>-${money(order.discount)}</span></div>
    <div class="receipt-total"><span>Tổng cộng</span><span>${money(order.total)}</span></div>
    <div><span>Công ty</span><span>${order.company}</span></div>
    <div><span>Người liên hệ</span><span>${order.name}</span></div>
    <div><span>SĐT</span><span>${order.phone}</span></div>
    <div><span>Địa chỉ</span><span>${order.address}</span></div>
    <div><span>Thanh toán</span><span>${order.payment}</span></div>
  `;
  updateStatusTrack("placed");
}

const STATUS_FLOW = ["placed", "confirmed", "packing", "delivering", "done"];
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
  return JSON.parse(localStorage.getItem("tucaphe_orders_b2b") || "[]");
}
function saveOrderToHistory(order) {
  const history = getHistory();
  history.unshift(order);
  localStorage.setItem("tucaphe_orders_b2b", JSON.stringify(history.slice(0, 20)));
  renderHistory();
}
function updateOrderStatusInHistory(orderId, status) {
  const history = getHistory();
  const o = history.find(h => h.id === orderId);
  if (o) { o.status = status; localStorage.setItem("tucaphe_orders_b2b", JSON.stringify(history)); }
}
const STATUS_LABEL = {
  placed: "Đã đặt hàng", confirmed: "Đã xác nhận", packing: "Đang đóng gói",
  delivering: "Đang vận chuyển", done: "Đã giao hàng",
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
      <span>${o.company || ""}</span>
      <span>${o.lines.reduce((s, l) => s + l.qty, 0)}kg · ${money(o.total)}</span>
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
      <td>${qty <= 0 ? '<span class="stock-badge out">Hết hàng</span>' : qty <= p.minOrderKg * 2 ? `<span class="stock-badge low">${qty}kg</span>` : qty + "kg"}</td>
      <td>
        <div class="restock-control">
          <input type="number" min="1" value="100" id="restock-${p.id}">
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
document.getElementById("stockToggle2").addEventListener("click", openStockModal);
document.getElementById("closeStockModal").addEventListener("click", closeStockModal);

// ===== INIT =====
function init() {
  renderCategoryTabs();
  renderQuickBar();
  renderProductGrid();
  updateCartCount();
  renderCartDrawer();
  renderHistory();
  renderStockTable();
  goToStep(1);
}
init();
