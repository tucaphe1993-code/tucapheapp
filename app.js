// ===== DỮ LIỆU SẢN PHẨM (CÀ PHÊ HẠT + PHỤ KIỆN BÁN SỈ) =====
const CATEGORIES = [
  { id: "arabica", name: "Arabica" },
  { id: "robusta", name: "Robusta" },
  { id: "dacsan", name: "Hạt đặc sản" },
  { id: "blend", name: "Blend hỗn hợp" },
  { id: "phukien", name: "Phụ kiện & Thiết bị" },
];

// price = đơn giá gốc (VNĐ) trước khi áp giá sỉ riêng; stock/minOrder/unit theo từng loại đơn vị
const PRODUCTS = [
  { id: "p1", cat: "arabica", name: "Arabica Cầu Đất", origin: "Đà Lạt", desc: "Rang vừa, vị chua thanh, hương hoa quả", price: 220000, icon: "☕", stock: 500, minOrder: 10, unit: "kg" },
  { id: "p2", cat: "arabica", name: "Arabica Rang Mộc", origin: "Sơn La", desc: "Nguyên chất, phù hợp pha máy espresso", price: 230000, icon: "☕", stock: 250, minOrder: 10, unit: "kg" },
  { id: "p3", cat: "robusta", name: "Robusta Buôn Ma Thuột", origin: "Đắk Lắk", desc: "Rang đậm, vị đắng mạnh, nhiều caffeine", price: 140000, icon: "🫘", stock: 800, minOrder: 20, unit: "kg" },
  { id: "p4", cat: "robusta", name: "Robusta Rang Mộc", origin: "Đắk Nông", desc: "Nguyên chất, chuyên dùng pha phin", price: 135000, icon: "🫘", stock: 700, minOrder: 20, unit: "kg" },
  { id: "p5", cat: "dacsan", name: "Culi Robusta", origin: "Đắk Lắk", desc: "Hạt tròn đặc biệt, đậm đà hiếm có", price: 160000, icon: "🌰", stock: 300, minOrder: 10, unit: "kg" },
  { id: "p6", cat: "dacsan", name: "Moka Cầu Đất", origin: "Đà Lạt", desc: "Hương thơm đặc trưng, sản lượng thấp", price: 350000, icon: "🌸", stock: 150, minOrder: 5, unit: "kg" },
  { id: "p7", cat: "dacsan", name: "Cherry (Excelsa)", origin: "Quảng Trị", desc: "Vị chua nhẹ, hậu vị trái cây", price: 130000, icon: "🍒", stock: 200, minOrder: 10, unit: "kg" },
  { id: "p8", cat: "blend", name: "Blend 4 Loại Hạt", origin: "Hỗn hợp", desc: "Arabica, Robusta, Culi, Cherry cân bằng", price: 180000, icon: "🥣", stock: 600, minOrder: 20, unit: "kg" },
  { id: "p9", cat: "blend", name: "Blend Espresso Ý", origin: "Hỗn hợp", desc: "Công thức rang đậm chuẩn quán cà phê", price: 195000, icon: "🥣", stock: 400, minOrder: 20, unit: "kg" },
  { id: "a1", cat: "phukien", name: "Túi zip van thoát khí 1kg", origin: "Phụ kiện", desc: "Thùng 100 túi, giữ hương cà phê tối ưu", price: 450000, icon: "👝", stock: 200, minOrder: 5, unit: "thùng" },
  { id: "a2", cat: "phukien", name: "Bao bì kraft dán nhãn thương hiệu", origin: "Phụ kiện", desc: "Thùng 200 túi kraft cao cấp, có van", price: 1200000, icon: "🏷️", stock: 60, minOrder: 1, unit: "thùng" },
  { id: "a3", cat: "phukien", name: "Máy rang cà phê mini 1kg/mẻ", origin: "Thiết bị", desc: "Phù hợp quán rang tại chỗ", price: 18500000, icon: "🔥", stock: 15, minOrder: 1, unit: "cái" },
  { id: "a4", cat: "phukien", name: "Máy xay cà phê công nghiệp", origin: "Thiết bị", desc: "Công suất lớn, xay đều hạt", price: 9200000, icon: "⚙️", stock: 20, minOrder: 1, unit: "cái" },
  { id: "a5", cat: "phukien", name: "Ly giấy có nắp", origin: "Phụ kiện", desc: "Thùng 50 cái, dùng cho quán mang đi", price: 220000, icon: "🥤", stock: 300, minOrder: 5, unit: "thùng" },
];
const CAT_NAME = Object.fromEntries(CATEGORIES.map(c => [c.id, c.name]));
const fmtQty = (qty, unit) => unit === "kg" ? `${qty}kg` : `${qty} ${unit}`;

// Chiết khấu theo sản lượng đặt của MỖI sản phẩm (cộng thêm trên giá sỉ riêng của khách)
const TIERS = [
  { minQty: 100, rate: 0.10 },
  { minQty: 50, rate: 0.05 },
];
function tierRateFor(qty) {
  const tier = TIERS.find(t => qty >= t.minQty);
  return tier ? tier.rate : 0;
}

// ===== KHÁCH HÀNG SỈ (mỗi khách một mức giá & hạn mức công nợ riêng) =====
const CUSTOMERS = [
  { id: "guest", phone: "", name: "Khách vãng lai", tier: "Chưa đăng nhập", discount: 0, debtLimit: 0,
    offer: "Đăng nhập bằng số điện thoại đối tác để nhận giá sỉ riêng, công nợ và ưu đãi cá nhân hoá." },
  { id: "kh1", phone: "0901111111", name: "Quán Cà Phê Xanh", tier: "Đối tác Bạc", discount: 0, debtLimit: 20000000,
    offer: "Tặng 2kg Robusta khi tổng sản lượng đặt trong tháng đạt 200kg." },
  { id: "kh2", phone: "0902222222", name: "Chuỗi The Green Bean", tier: "Đối tác Vàng", discount: 0.03, debtLimit: 50000000,
    offer: "Giảm thêm 3% trên mọi đơn hàng, áp dụng tự động." },
  { id: "kh3", phone: "0903333333", name: "Xưởng Rang Xay Phúc An", tier: "Đối tác Kim Cương", discount: 0.06, debtLimit: 100000000,
    offer: "Giảm thêm 6% và miễn phí vận chuyển toàn quốc." },
];
const CUSTOMER_KEY = "tucaphe_current_customer_b2b";
function getCurrentCustomer() {
  const id = localStorage.getItem(CUSTOMER_KEY) || "guest";
  return CUSTOMERS.find(c => c.id === id) || CUSTOMERS[0];
}
function setCurrentCustomer(id) {
  localStorage.setItem(CUSTOMER_KEY, id);
  updateCustomerBadge();
  renderProductGrid();
  renderCartSection();
  renderCartDrawer();
  const activeView = document.querySelector(".nav-link.active")?.dataset.view || "order";
  if (activeView === "track") renderTrackView();
  if (activeView === "debt") renderDebtView();
  if (activeView === "history") renderHistoryView();
  if (activeView === "offers") renderOffersView();
}
function personalPrice(p) {
  const c = getCurrentCustomer();
  return Math.round((p.price * (1 - c.discount)) / 100) * 100;
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

// ===== CÔNG NỢ STORE (localStorage) =====
function loadDebtStore() { return JSON.parse(localStorage.getItem("tucaphe_debt_b2b") || "{}"); }
function saveDebtStore(d) { localStorage.setItem("tucaphe_debt_b2b", JSON.stringify(d)); }
function getDebt(customerId) { return loadDebtStore()[customerId] || 0; }
function addDebt(customerId, amount) { const d = loadDebtStore(); d[customerId] = (d[customerId] || 0) + amount; saveDebtStore(d); }
function reduceDebt(customerId, amount) { const d = loadDebtStore(); d[customerId] = Math.max(0, (d[customerId] || 0) - amount); saveDebtStore(d); }

// ===== STATE =====
let cart = JSON.parse(localStorage.getItem("tucaphe_cart_b2b") || "{}"); // { productId: qty }
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

// ===== RENDER: QUICK ORDER BAR =====
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
    let badgeClass = "", badgeText = `Còn ${fmtQty(available, p.unit)}`;
    if (available <= 0) { badgeClass = "out"; badgeText = "Hết hàng"; }
    else if (available <= p.minOrder * 2) { badgeClass = "low"; badgeText = `Sắp hết: ${fmtQty(available, p.unit)}`; }
    const defaultQty = Math.min(p.minOrder, Math.max(1, remaining));
    const unitPrice = personalPrice(p);
    const hasDiscount = unitPrice < p.price;
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
        <div class="min-order">Đặt tối thiểu ${fmtQty(p.minOrder, p.unit)} / lần</div>
        <div class="product-price">${hasDiscount ? `<span class="orig-price">${money(p.price)}</span>` : ""}${money(unitPrice)} <small>/ ${p.unit}</small></div>
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
      const maxQty = Math.max(p.minOrder, getStock(id) - (cart[id] || 0));
      let val = parseInt(input.value, 10) || p.minOrder;
      val = btn.dataset.act === "inc" ? Math.min(maxQty, val + p.minOrder) : Math.max(p.minOrder, val - p.minOrder);
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
      const unitPrice = personalPrice(p);
      const rate = tierRateFor(qty);
      const base = unitPrice * qty;
      const discount = base * rate;
      return { ...p, qty, unitPrice, rate, base, discount, lineTotal: base - discount };
    });
}
function getCartSubtotal() { return getCartLines().reduce((s, l) => s + l.base, 0); }
function getCartDiscountTotal() { return getCartLines().reduce((s, l) => s + l.discount, 0); }
function getCartTotal() { return getCartLines().reduce((sum, l) => sum + l.lineTotal, 0); }

function updateCartCount() {
  document.getElementById("cartCount").textContent = Object.keys(cart).filter(k => cart[k] > 0).length;
}

// ===== RENDER: CART SECTION (step 2) & DRAWER =====
function cartItemsHtml(lines) {
  if (lines.length === 0) return `<div class="empty-msg">Giỏ hàng đang trống. Hãy chọn sản phẩm cần đặt!</div>`;
  return lines.map(l => `
    <div class="cart-item">
      <div class="cart-item-icon">${l.icon}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${l.name}</div>
        <div class="cart-item-price">${money(l.unitPrice)}/${l.unit} × ${fmtQty(l.qty, l.unit)}</div>
        ${l.rate > 0 ? `<div class="cart-item-discount">Chiết khấu sản lượng -${Math.round(l.rate * 100)}%</div>` : ""}
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

// ===== STEPPER / PANEL NAVIGATION (trong luồng Đặt cà phê) =====
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
  if (step === 3) prefillCheckoutForCustomer();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function prefillCheckoutForCustomer() {
  const c = getCurrentCustomer();
  const companyInput = document.getElementById("custCompany");
  const phoneInput = document.getElementById("custPhone");
  if (c.id !== "guest") {
    if (!companyInput.value) companyInput.value = c.name;
    if (!phoneInput.value) phoneInput.value = c.phone;
  }
  document.getElementById("checkoutTotal").textContent = money(getCartTotal());

  const debtRadio = document.getElementById("paymentDebtRadio");
  const debtNote = document.getElementById("debtNote");
  const used = getDebt(c.id);
  const remain = c.debtLimit - used;
  if (c.debtLimit <= 0) {
    debtRadio.disabled = true;
    debtNote.textContent = "* Đăng nhập bằng tài khoản đối tác được cấp hạn mức để sử dụng công nợ.";
  } else {
    debtRadio.disabled = false;
    debtNote.textContent = `* Hạn mức còn lại: ${money(Math.max(0, remain))} / ${money(c.debtLimit)}`;
  }
}

document.querySelectorAll("[data-goto]").forEach(btn => {
  btn.addEventListener("click", (e) => { e.preventDefault(); goToStep(parseInt(btn.dataset.goto, 10)); });
});
document.getElementById("heroOrderBtn").addEventListener("click", () => {
  document.getElementById("productGrid").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.getElementById("toCheckoutBtn").addEventListener("click", () => {
  if (getCartLines().length === 0) {
    alert("Giỏ hàng đang trống, hãy chọn ít nhất một sản phẩm.");
    return;
  }
  goToStep(3);
});

// ===== VIEW NAVIGATION (menu ngang: Đặt hàng / Theo dõi / Công nợ / Lịch sử / Ưu đãi) =====
const VIEWS = ["order", "track", "debt", "history", "offers"];
function showView(view) {
  VIEWS.forEach(v => document.getElementById("view-" + v).classList.toggle("active", v === view));
  document.querySelectorAll(".nav-link").forEach(a => a.classList.toggle("active", a.dataset.view === view));
  if (view === "track") renderTrackView();
  if (view === "debt") renderDebtView();
  if (view === "history") renderHistoryView();
  if (view === "offers") renderOffersView();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.querySelectorAll(".nav-link[data-view]").forEach(a => {
  a.addEventListener("click", (e) => { e.preventDefault(); showView(a.dataset.view); });
});

// ===== CART DRAWER TOGGLE =====
const cartDrawer = document.getElementById("cartDrawer");
const overlay = document.getElementById("overlay");
function openDrawer() { renderCartDrawer(); cartDrawer.classList.add("open"); overlay.classList.add("show"); }
function closeDrawer() { cartDrawer.classList.remove("open"); overlay.classList.remove("show"); }
document.getElementById("cartToggle").addEventListener("click", openDrawer);
document.getElementById("closeDrawer").addEventListener("click", closeDrawer);
overlay.addEventListener("click", () => { closeDrawer(); closeStockModal(); closeLoginModal(); });
document.getElementById("drawerCheckoutBtn").addEventListener("click", () => {
  closeDrawer();
  showView("order");
  goToStep(2);
});

// ===== CHECKOUT SUBMIT =====
document.getElementById("checkoutForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const lines = getCartLines();
  if (lines.length === 0) {
    alert("Giỏ hàng đang trống.");
    goToStep(1);
    return;
  }
  const customer = getCurrentCustomer();
  const payment = document.querySelector('input[name="payment"]:checked').value;
  const total = getCartTotal();

  if (payment === "debt") {
    if (customer.id === "guest") { alert("Vui lòng đăng nhập bằng tài khoản đối tác để sử dụng hình thức công nợ."); return; }
    const projected = getDebt(customer.id) + total;
    if (projected > customer.debtLimit) {
      alert(`Đơn hàng vượt hạn mức công nợ.\nHạn mức: ${money(customer.debtLimit)}\nĐã sử dụng: ${money(getDebt(customer.id))}\nĐơn này: ${money(total)}`);
      return;
    }
  }

  const company = document.getElementById("custCompany").value.trim();
  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const tax = document.getElementById("custTax").value.trim();
  const address = document.getElementById("custAddress").value.trim();
  const note = document.getElementById("custNote").value.trim();
  const paymentLabel = { cod: "Thanh toán khi nhận hàng (COD)", transfer: "Chuyển khoản ngân hàng", debt: "Công nợ 30 ngày" }[payment];

  const subtotal = getCartSubtotal();
  const discount = getCartDiscountTotal();
  const orderId = "TCFB2B" + Date.now().toString().slice(-8);

  lastOrder = {
    id: orderId,
    customerId: customer.id,
    company, name, phone, tax, address, note, payment: paymentLabel, paymentType: payment,
    debtSettled: payment !== "debt",
    lines, subtotal, discount, total,
    createdAt: new Date().toISOString(),
    status: "placed",
  };

  lines.forEach(l => { stock[l.id] = Math.max(0, getStock(l.id) - l.qty); });
  saveStock();
  renderStockTable();

  if (payment === "debt") addDebt(customer.id, total);

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
    ${order.lines.map(l => `<div><span>${l.name} × ${fmtQty(l.qty, l.unit)}${l.rate > 0 ? ` (-${Math.round(l.rate * 100)}%)` : ""}</span><span>${money(l.lineTotal)}</span></div>`).join("")}
    <div><span>Tạm tính</span><span>${money(order.subtotal)}</span></div>
    <div><span>Chiết khấu</span><span>-${money(order.discount)}</span></div>
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
const STATUS_LABEL = {
  placed: "Đã đặt hàng", confirmed: "Đã xác nhận", packing: "Đang đóng gói",
  delivering: "Đang vận chuyển", done: "Đã giao hàng",
};
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
  }, 4000);
}

document.getElementById("newOrderBtn").addEventListener("click", () => goToStep(1));

// ===== ORDER HISTORY (localStorage, dùng chung cho Theo dõi đơn / Công nợ / Lịch sử) =====
function getAllHistory() { return JSON.parse(localStorage.getItem("tucaphe_orders_b2b") || "[]"); }
function getCustomerHistory(customerId) { return getAllHistory().filter(o => o.customerId === customerId); }
function saveOrderToHistory(order) {
  const history = getAllHistory();
  history.unshift(order);
  localStorage.setItem("tucaphe_orders_b2b", JSON.stringify(history.slice(0, 50)));
}
function updateOrderStatusInHistory(orderId, status) {
  const history = getAllHistory();
  const o = history.find(h => h.id === orderId);
  if (o) { o.status = status; localStorage.setItem("tucaphe_orders_b2b", JSON.stringify(history)); }
}

function historyRowHtml(o, { reorder } = {}) {
  return `
    <div class="history-item">
      <span class="hid">#${o.id}</span>
      <span>${new Date(o.createdAt).toLocaleString("vi-VN")}</span>
      <span>${o.lines.length} sản phẩm · ${money(o.total)}</span>
      <span class="history-badge">${STATUS_LABEL[o.status] || o.status}</span>
      ${reorder ? `<button class="btn secondary sm" data-reorder="${o.id}">🔄 Đặt lại</button>` : ""}
    </div>`;
}

// ===== VIEW: THEO DÕI ĐƠN =====
function renderTrackView() {
  const container = document.getElementById("trackList");
  const c = getCurrentCustomer();
  if (c.id === "guest") { container.innerHTML = `<div class="empty-msg">Đăng nhập để theo dõi đơn hàng của bạn.</div>`; return; }
  const orders = getCustomerHistory(c.id).filter(o => o.status !== "done");
  container.innerHTML = orders.length
    ? orders.map(o => historyRowHtml(o)).join("")
    : `<div class="empty-msg">Bạn không có đơn hàng nào đang xử lý.</div>`;
}

// ===== VIEW: LỊCH SỬ MUA HÀNG (có nút Đặt lại) =====
function renderHistoryView() {
  const container = document.getElementById("historyList");
  const c = getCurrentCustomer();
  if (c.id === "guest") { container.innerHTML = `<div class="empty-msg">Đăng nhập để xem lịch sử mua hàng của bạn.</div>`; return; }
  const orders = getCustomerHistory(c.id);
  if (!orders.length) { container.innerHTML = `<div class="empty-msg">Chưa có đơn hàng nào.</div>`; return; }
  container.innerHTML = orders.map(o => historyRowHtml(o, { reorder: true })).join("");
  container.querySelectorAll("[data-reorder]").forEach(btn => {
    btn.addEventListener("click", () => reorderOrder(btn.dataset.reorder));
  });
}

function reorderOrder(orderId) {
  const order = getAllHistory().find(o => o.id === orderId);
  if (!order) return;
  const unavailable = [];
  order.lines.forEach(l => {
    const avail = getStock(l.id) - (cart[l.id] || 0);
    if (avail <= 0) { unavailable.push(`${l.name} (đã hết hàng)`); return; }
    const addQty = Math.min(l.qty, avail);
    cart[l.id] = (cart[l.id] || 0) + addQty;
    if (addQty < l.qty) unavailable.push(`${l.name} (chỉ còn ${fmtQty(avail, l.unit)})`);
  });
  saveCart();
  updateCartCount();
  renderCartDrawer();
  renderProductGrid();
  if (unavailable.length) alert("Một số sản phẩm không đủ tồn kho để đặt lại đầy đủ:\n" + unavailable.join("\n"));
  showView("order");
  goToStep(2);
}

// ===== VIEW: CÔNG NỢ =====
function renderDebtView() {
  const c = getCurrentCustomer();
  const summary = document.getElementById("debtSummary");
  const list = document.getElementById("debtList");
  if (c.id === "guest") {
    summary.innerHTML = "";
    list.innerHTML = `<div class="empty-msg">Đăng nhập để xem công nợ của đối tác.</div>`;
    return;
  }
  const used = getDebt(c.id);
  const limit = c.debtLimit;
  const remain = Math.max(0, limit - used);
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  summary.innerHTML = `
    <div class="debt-cards">
      <div class="debt-card"><span>Hạn mức công nợ</span><strong>${money(limit)}</strong></div>
      <div class="debt-card"><span>Đã sử dụng</span><strong class="danger">${money(used)}</strong></div>
      <div class="debt-card"><span>Còn lại</span><strong class="success">${money(remain)}</strong></div>
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
  `;
  const debtOrders = getCustomerHistory(c.id).filter(o => o.paymentType === "debt" && !o.debtSettled);
  if (!debtOrders.length) { list.innerHTML = `<div class="empty-msg">Không có công nợ chưa thanh toán.</div>`; return; }
  list.innerHTML = debtOrders.map(o => `
    <div class="history-item">
      <span class="hid">#${o.id}</span>
      <span>${new Date(o.createdAt).toLocaleString("vi-VN")}</span>
      <span>${money(o.total)}</span>
      <span class="history-badge">Chưa thanh toán</span>
      <button class="btn primary sm" data-paydebt="${o.id}">💵 Đánh dấu đã thanh toán</button>
    </div>`).join("");
  list.querySelectorAll("[data-paydebt]").forEach(btn => {
    btn.addEventListener("click", () => markDebtPaid(btn.dataset.paydebt));
  });
}

function markDebtPaid(orderId) {
  const history = getAllHistory();
  const o = history.find(h => h.id === orderId);
  if (!o) return;
  o.debtSettled = true;
  localStorage.setItem("tucaphe_orders_b2b", JSON.stringify(history));
  reduceDebt(o.customerId, o.total);
  renderDebtView();
}

// ===== VIEW: ƯU ĐÃI RIÊNG =====
function tierTableHtml() {
  return `<div class="tier-table">${CUSTOMERS.filter(c => c.id !== "guest").map(c => `
    <div class="tier-row"><span>${c.tier}</span><span>${Math.round(c.discount * 100)}% chiết khấu</span></div>
  `).join("")}</div>`;
}
function renderOffersView() {
  const c = getCurrentCustomer();
  const el = document.getElementById("offersContent");
  if (c.id === "guest") {
    el.innerHTML = `<div class="offer-card"><p>${c.offer}</p></div>${tierTableHtml()}`;
    return;
  }
  el.innerHTML = `
    <div class="offer-card highlight">
      <span class="tier-badge">${c.tier}</span>
      <h3>Xin chào, ${c.name}!</h3>
      <p>${c.offer}</p>
      <p class="offer-discount">Chiết khấu riêng: <strong>${Math.round(c.discount * 100)}%</strong> áp dụng tự động trên mọi đơn hàng</p>
    </div>
    ${tierTableHtml()}
  `;
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
      <td>${money(p.price)}/${p.unit}</td>
      <td>${qty <= 0 ? '<span class="stock-badge out">Hết hàng</span>' : qty <= p.minOrder * 2 ? `<span class="stock-badge low">${fmtQty(qty, p.unit)}</span>` : fmtQty(qty, p.unit)}</td>
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
document.getElementById("stockToggle2").addEventListener("click", openStockModal);
document.getElementById("closeStockModal").addEventListener("click", closeStockModal);

// ===== LOGIN / CUSTOMER SWITCH MODAL =====
const loginModal = document.getElementById("loginModal");
function openLoginModal() { loginModal.classList.add("open"); overlay.classList.add("show"); }
function closeLoginModal() { loginModal.classList.remove("open"); overlay.classList.remove("show"); }
document.getElementById("customerBtn").addEventListener("click", openLoginModal);
document.getElementById("closeLoginModal").addEventListener("click", closeLoginModal);
document.getElementById("loginSubmitBtn").addEventListener("click", () => {
  const phone = document.getElementById("loginPhone").value.trim();
  const found = CUSTOMERS.find(c => c.phone === phone);
  if (!found) { alert("Không tìm thấy đối tác với số điện thoại này.\nDùng thử: 0901111111, 0902222222 hoặc 0903333333."); return; }
  setCurrentCustomer(found.id);
  document.getElementById("loginPhone").value = "";
  closeLoginModal();
});
document.getElementById("logoutBtn").addEventListener("click", () => {
  setCurrentCustomer("guest");
  closeLoginModal();
});
function updateCustomerBadge() {
  const c = getCurrentCustomer();
  document.getElementById("customerNameTag").textContent = c.id === "guest" ? "Đăng nhập" : c.name;
}

// ===== INIT =====
function init() {
  renderCategoryTabs();
  renderQuickBar();
  renderProductGrid();
  updateCartCount();
  renderCartDrawer();
  renderStockTable();
  updateCustomerBadge();
  showView("order");
  goToStep(1);
}
init();
