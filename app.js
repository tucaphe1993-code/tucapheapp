// =====================================================================
// ⚠️ KHỐI DỮ LIỆU MẪU (DEMO) — CHƯA KẾT NỐI LARK BASE / BACKEND THẬT
// Toàn bộ PRODUCTS, CUSTOMERS bên dưới là dữ liệu giả lập để phát triển
// và kiểm thử giao diện. KHÔNG dùng để vận hành thật.
// Khi có dữ liệu thực tế (Lark Base "01 – NHẬT KÝ BÁN HÀNG" + bảng khách
// hàng/sản phẩm), thay thế bằng lời gọi API tương ứng — xem khối
// "KIẾN TRÚC KẾT NỐI BACKEND / LARK BASE" ở cuối file.
// =====================================================================

const CATEGORIES = [
  { id: "arabica", name: "Arabica" },
  { id: "robusta", name: "Robusta" },
  { id: "dacsan", name: "Hạt đặc sản" },
  { id: "blend", name: "Blend hỗn hợp" },
  { id: "phukien", name: "Phụ kiện & Thiết bị" },
];

// price: null nghĩa là CHƯA CÓ GIÁ THẬT — hệ thống phải hiển thị "Chưa cập nhật giá"
// và không cho đặt hàng, TUYỆT ĐỐI không tự bịa giá.
// stock: null nghĩa là CHƯA CÓ DỮ LIỆU TỒN KHO thật.
const PRODUCTS = [
  // --- DỮ LIỆU MẪU (demo, giá minh hoạ) ---
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
  // --- DỮ LIỆU THẬT do khách hàng cung cấp (giữ nguyên, không tự chỉnh giá) ---
  { id: "real_honey", cat: "dacsan", name: "Honey Reserve", origin: "Chưa cập nhật", desc: "Chưa có mô tả chi tiết — đang chờ Tú Cà Phê cập nhật", price: 275000, icon: "🍯", stock: null, minOrder: 1, unit: "kg" },
  // --- MINH HOẠ trạng thái "chưa có giá" / "chưa có tồn kho" theo đúng yêu cầu ---
  { id: "demo_noprice", cat: "blend", name: "[DEMO] Sản phẩm chờ cập nhật giá", origin: "—", desc: "Ví dụ minh hoạ khi hệ thống chưa có giá sỉ — không phải sản phẩm thật", price: null, icon: "❓", stock: 100, minOrder: 1, unit: "kg" },
];
const CAT_NAME = Object.fromEntries(CATEGORIES.map(c => [c.id, c.name]));
const fmtQty = (qty, unit) => unit === "kg" ? `${qty}kg` : `${qty} ${unit}`;
const hasValidPrice = (p) => typeof p.price === "number" && p.price > 0;
const hasValidStock = (p) => typeof p.stock === "number";
const isOrderable = (p) => hasValidPrice(p) && hasValidStock(p);

// Chiết khấu theo sản lượng đặt của MỖI sản phẩm (cộng thêm trên giá sỉ riêng của khách)
const TIERS = [
  { minQty: 100, rate: 0.10 },
  { minQty: 50, rate: 0.05 },
];
function tierRateFor(qty) {
  const tier = TIERS.find(t => qty >= t.minQty);
  return tier ? tier.rate : 0;
}

// Điểm nhận hàng khi khách chọn "Khách đến lấy tại kho"
// TODO: cập nhật địa chỉ kho/xưởng thật của Tú Cà Phê
const PICKUP_LOCATIONS = [
  { id: "kho1", name: "Kho/Xưởng Tú Cà Phê (địa chỉ cần cập nhật)" },
];

// =====================================================================
// ⚠️ KHÁCH HÀNG SỈ — DỮ LIỆU MOCK/LOCAL, CHƯA CÓ BACKEND/LARK BASE THẬT
// "password" ở đây CHỈ là dữ liệu demo để kiểm thử màn hình đăng nhập/đăng ký
// cục bộ, lưu dạng plain-text trong trình duyệt (localStorage). Đây KHÔNG PHẢI
// kiến trúc bảo mật production. Khi có backend/Lark Base thật:
//   - Mật khẩu phải được hash phía server (bcrypt/argon2...), không bao giờ
//     lưu hay so sánh plain-text ở frontend.
//   - Toàn bộ store CUSTOMERS bên dưới (localStorage) phải được thay bằng dữ
//     liệu lấy qua API — xem authenticateCustomer() và registerCustomer().
// =====================================================================
//
// Sơ đồ dữ liệu (chuẩn bị cho bước sau — giá riêng / Lark Base):
//   CUSTOMER (id, phone, status...) → CUSTOMER ID → [sau này] BẢNG GIÁ RIÊNG
//   → SẢN PHẨM → ĐƠN HÀNG (customerId) → LỊCH SỬ MUA HÀNG (lọc theo customerId)
//   → LARK BASE. Mỗi khách có thể có mức giá khác nhau — KHÔNG có giá cố định
//   chung cho tất cả khách (trường "discount" hiện tại chỉ là placeholder demo).

// Trạng thái tài khoản hợp lệ. "pending" = khách mới đăng ký, chờ Tú Cà Phê duyệt.
const CUSTOMER_STATUS = { PENDING: "pending", ACTIVE: "active", BLOCKED: "blocked" };
const CUSTOMER_STATUS_LABEL = {
  pending: "Chờ duyệt", active: "Đang hoạt động", blocked: "Bị khoá",
};

// Dữ liệu khởi tạo (seed) — CHỈ dùng lần đầu tiên khi trình duyệt chưa có store.
// Sau đó mọi thay đổi (đăng ký mới, sửa hồ sơ) được lưu vào localStorage, xem
// loadCustomerStore()/saveCustomerStore() bên dưới.
const CUSTOMER_SEED = [
  { id: "guest", phone: "", password: null, name: "Khách vãng lai", company: "", email: "", address: "",
    tier: "Chưa đăng nhập", group: "—", discount: 0, debtLimit: 0, status: CUSTOMER_STATUS.ACTIVE,
    offer: "Đăng nhập hoặc đăng ký tài khoản đối tác để nhận giá sỉ riêng, công nợ và ưu đãi cá nhân hoá." },
  // --- Tài khoản mẫu theo yêu cầu: dùng để kiểm thử đăng nhập/trạng thái tài khoản ---
  { id: "KH00001", phone: "0900000000", password: "123456", name: "Khách hàng test", company: "", email: "", address: "",
    tier: "Khách mẫu", group: "—", discount: 0, debtLimit: 0, status: CUSTOMER_STATUS.ACTIVE,
    offer: "Tài khoản khách hàng mẫu (active) — chưa có giá sỉ riêng hay hạn mức công nợ (sẽ cập nhật ở bước sau)." },
  { id: "KH00002", phone: "0900000002", password: "123456", name: "Đối tác chờ duyệt (demo)", company: "", email: "", address: "",
    tier: "Khách mẫu", group: "—", discount: 0, debtLimit: 0, status: CUSTOMER_STATUS.PENDING,
    offer: "" },
  { id: "KH00003", phone: "0900000003", password: "123456", name: "Đối tác bị khoá (demo)", company: "", email: "", address: "",
    tier: "Khách mẫu", group: "—", discount: 0, debtLimit: 0, status: CUSTOMER_STATUS.BLOCKED,
    offer: "" },
  // --- Các khách demo có sẵn từ trước (giữ nguyên giá sỉ/công nợ, chỉ thêm mật khẩu + trạng thái) ---
  { id: "kh1", phone: "0901111111", password: "123456", name: "Nguyễn Văn A", company: "Quán Cà Phê Xanh", email: "", address: "",
    tier: "Đối tác Bạc", group: "Quán cà phê", discount: 0, debtLimit: 20000000, status: CUSTOMER_STATUS.ACTIVE,
    offer: "Tặng 2kg Robusta khi tổng sản lượng đặt trong tháng đạt 200kg." },
  { id: "kh2", phone: "0902222222", password: "123456", name: "Trần Thị B", company: "Chuỗi The Green Bean", email: "", address: "",
    tier: "Đối tác Vàng", group: "Chuỗi cửa hàng", discount: 0.03, debtLimit: 50000000, status: CUSTOMER_STATUS.ACTIVE,
    offer: "Giảm thêm 3% trên mọi đơn hàng, áp dụng tự động." },
  { id: "kh3", phone: "0903333333", password: "123456", name: "Lê Văn C", company: "Xưởng Rang Xay Phúc An", email: "", address: "",
    tier: "Đối tác Kim Cương", group: "Xưởng rang xay", discount: 0.06, debtLimit: 100000000, status: CUSTOMER_STATUS.ACTIVE,
    offer: "Giảm thêm 6% và miễn phí vận chuyển toàn quốc." },
];

// ===== STORE KHÁCH HÀNG (localStorage) — cho phép đăng ký mới & sửa hồ sơ =====
const CUSTOMERS_STORE_KEY = "tucaphe_customers_b2b";
function loadCustomerStore() {
  const saved = JSON.parse(localStorage.getItem(CUSTOMERS_STORE_KEY) || "null");
  if (saved && Array.isArray(saved)) return saved;
  const seeded = CUSTOMER_SEED.map(c => ({ ...c }));
  localStorage.setItem(CUSTOMERS_STORE_KEY, JSON.stringify(seeded));
  return seeded;
}
function saveCustomerStore() { localStorage.setItem(CUSTOMERS_STORE_KEY, JSON.stringify(CUSTOMERS)); }
let CUSTOMERS = loadCustomerStore();

// Mã khách hàng tự sinh dạng KH00001, KH00002... — không cho khách tự nhập.
// Đếm bắt đầu sau các ID mẫu (KH00001-KH00003) để không trùng.
const CUSTOMER_SEQ_KEY = "tucaphe_customer_seq_b2b";
function nextCustomerId() {
  const seq = parseInt(localStorage.getItem(CUSTOMER_SEQ_KEY) || "3", 10) + 1;
  localStorage.setItem(CUSTOMER_SEQ_KEY, String(seq));
  return "KH" + String(seq).padStart(5, "0");
}

function isPhoneRegistered(phone) {
  return CUSTOMERS.some(c => c.id !== "guest" && c.phone === phone);
}

// ===== AUTH CONTRACT: cấu trúc rõ ràng để thay bằng backend thật sau này =====
// Hiện tại: đối chiếu SĐT + mật khẩu với store CUSTOMERS cục bộ (mật khẩu dạng
// plain-text) — CHỈ dùng để demo giao diện, KHÔNG PHẢI xác thực bảo mật thật
// (không mã hoá, không OTP, không token phiên, không rate-limit).
//
// Khi có backend/Lark Base thật, thay TOÀN BỘ nội dung 2 hàm dưới đây bằng lời
// gọi API, ví dụ:
//   async function authenticateCustomer(phone, password) {
//     const res = await fetch('/api/auth/login', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ phone, password }),
//     });
//     if (!res.ok) return null; // sai SĐT/mật khẩu -> backend trả lỗi
//     return res.json(); // { id, name, company, status, discount, debtLimit, ... }
//   }
//   async function registerCustomer(data) {
//     const res = await fetch('/api/auth/register', { method: 'POST', body: JSON.stringify(data) });
//     return res.json(); // backend tự sinh Customer ID, trạng thái mặc định "pending"
//   }
// Các nơi gọi 2 hàm này (nút Đăng nhập/Đăng ký) không cần đổi gì thêm khi có backend.
function authenticateCustomer(phone, password) {
  return CUSTOMERS.find(c => c.id !== "guest" && c.phone === phone && c.password === password) || null;
}
function registerCustomer({ name, company, phone, email, address, password }) {
  const id = nextCustomerId();
  const record = {
    id, phone, password, name, company, email: email || "", address,
    tier: "Khách mới", group: "—", discount: 0, debtLimit: 0,
    status: CUSTOMER_STATUS.PENDING,
    offer: "Tài khoản đang chờ Tú Cà Phê xác nhận. Sau khi được duyệt, bạn sẽ nhận giá sỉ riêng theo hạng đối tác.",
  };
  CUSTOMERS.push(record);
  saveCustomerStore();
  return record;
}
function updateCustomerProfile(id, patch) {
  const c = CUSTOMERS.find(x => x.id === id);
  if (!c) return null;
  Object.assign(c, patch);
  saveCustomerStore();
  return c;
}

const CUSTOMER_KEY = "tucaphe_current_customer_b2b";
function getCurrentCustomer() {
  const id = localStorage.getItem(CUSTOMER_KEY) || "guest";
  return CUSTOMERS.find(c => c.id === id) || CUSTOMERS[0];
}
function setCurrentCustomer(id) {
  localStorage.setItem(CUSTOMER_KEY, id);
  updateCustomerBadge();
  renderCustomerDashboard();
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
  if (!hasValidPrice(p)) return null;
  const c = getCurrentCustomer();
  return Math.round((p.price * (1 - c.discount)) / 100) * 100;
}

// ===== STOCK STORE (localStorage) =====
function loadStock() {
  const saved = JSON.parse(localStorage.getItem("tucaphe_stock_b2b") || "{}");
  const stock = {};
  PRODUCTS.forEach(p => {
    if (!hasValidStock(p)) { stock[p.id] = null; return; }
    stock[p.id] = saved[p.id] !== undefined && saved[p.id] !== null ? saved[p.id] : p.stock;
  });
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

// ===== MÃ ĐƠN HÀNG (GD-001, GD-002, ...) — chống trùng bằng counter cục bộ =====
// LƯU Ý: đây là counter phía trình duyệt (localStorage), chỉ đúng khi dùng 1 trình
// duyệt/1 máy. Khi có backend thật, mã đơn PHẢI được sinh phía server (atomic) để
// đảm bảo không trùng giữa nhiều khách hàng/nhiều thiết bị cùng lúc.
const ORDER_SEQ_KEY = "tucaphe_order_seq_b2b";
function nextOrderId() {
  const seq = parseInt(localStorage.getItem(ORDER_SEQ_KEY) || "0", 10) + 1;
  localStorage.setItem(ORDER_SEQ_KEY, String(seq));
  return "GD-" + String(seq).padStart(3, "0");
}

// ===== STATE =====
let cart = JSON.parse(localStorage.getItem("tucaphe_cart_b2b") || "{}"); // { productId: qty }
let currentCategory = "arabica";
let currentStep = 1;
let lastOrder = null;
let draftOrder = null;       // đơn nháp đang chờ khách xác nhận ở bước Review
let isSubmittingOrder = false; // khoá chống bấm/tạo đơn trùng

const money = (n) => Math.round(n).toLocaleString("vi-VN") + "₫";
const saveCart = () => localStorage.setItem("tucaphe_cart_b2b", JSON.stringify(cart));
const todayISO = () => new Date().toISOString().slice(0, 10);

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
    const orderable = isOrderable(p);
    const available = hasValidStock(p) ? getStock(p.id) : null;
    const inCart = cart[p.id] || 0;
    const remaining = orderable ? Math.max(0, available - inCart) : 0;
    const outOfStock = !orderable || remaining <= 0;

    let badgeClass = "", badgeText = "";
    if (!hasValidPrice(p)) { badgeClass = "out"; badgeText = "Chưa cập nhật giá"; }
    else if (!hasValidStock(p)) { badgeClass = "low"; badgeText = "Chưa cập nhật tồn kho"; }
    else if (available <= 0) { badgeClass = "out"; badgeText = "Hết hàng"; }
    else if (available <= p.minOrder * 2) { badgeClass = "low"; badgeText = `Sắp hết: ${fmtQty(available, p.unit)}`; }
    else { badgeText = `Còn ${fmtQty(available, p.unit)}`; }

    const defaultQty = orderable ? Math.min(p.minOrder, Math.max(1, remaining)) : p.minOrder;
    const unitPrice = personalPrice(p);
    const hasDiscount = orderable && unitPrice < p.price;
    const priceHtml = hasValidPrice(p)
      ? `${hasDiscount ? `<span class="orig-price">${money(p.price)}</span>` : ""}${money(unitPrice)} <small>/ ${p.unit}</small>`
      : `<span class="no-price">Chưa cập nhật giá</span>`;

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
        <div class="product-price">${priceHtml}</div>
        <div class="qty-row">
          <div class="qty-control">
            <button data-act="dec" data-id="${p.id}" ${outOfStock ? "disabled" : ""}>−</button>
            <input type="text" readonly id="qty-${p.id}" value="${defaultQty}">
            <button data-act="inc" data-id="${p.id}" ${outOfStock ? "disabled" : ""}>+</button>
          </div>
          <button class="add-btn" data-add="${p.id}" ${outOfStock ? "disabled" : ""}>${!hasValidPrice(p) ? "Chưa có giá" : !hasValidStock(p) ? "Chưa có tồn kho" : outOfStock ? "Hết hàng" : "Thêm"}</button>
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
      const p = PRODUCTS.find(pr => pr.id === id);
      if (!isOrderable(p)) return;
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
    .map(([id]) => PRODUCTS.find(pr => pr.id === id))
    .filter(p => p && isOrderable(p)) // dữ liệu không hợp lệ (mất giá/hết dữ liệu) sẽ không được tính vào đơn
    .map(p => {
      const qty = cart[p.id];
      const unitPrice = personalPrice(p);
      const rate = tierRateFor(qty);
      const base = unitPrice * qty;
      const discount = Math.round(base * rate); // tránh lẻ tiền do phần trăm
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

// ===== STEPPER / PANEL NAVIGATION (luồng Đặt cà phê: 5 bước) =====
function goToStep(step) {
  currentStep = step;
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  const panelIds = { 1: "menuSection", 2: "cartSection", 3: "checkoutSection", 4: "reviewSection", 5: "confirmSection" };
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
  const nameInput = document.getElementById("custName");
  const phoneInput = document.getElementById("custPhone");
  if (c.id !== "guest") {
    if (!companyInput.value) companyInput.value = c.company || c.name;
    if (!nameInput.value) nameInput.value = c.name;
    if (!phoneInput.value) phoneInput.value = c.phone;
  }
  document.getElementById("checkoutTotal").textContent = money(getCartTotal());

  const dateInput = document.getElementById("deliveryDate");
  dateInput.min = todayISO();
  if (!dateInput.value) dateInput.value = todayISO();

  const pickupSel = document.getElementById("pickupLocation");
  if (!pickupSel.dataset.filled) {
    pickupSel.innerHTML = PICKUP_LOCATIONS.map(l => `<option value="${l.id}">${l.name}</option>`).join("");
    pickupSel.dataset.filled = "1";
  }

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

// Hiện/ẩn field theo hình thức nhận hàng
document.querySelectorAll('input[name="deliveryMethod"]').forEach(r => {
  r.addEventListener("change", updateDeliveryFieldsVisibility);
});
function updateDeliveryFieldsVisibility() {
  const method = document.querySelector('input[name="deliveryMethod"]:checked')?.value;
  document.getElementById("deliveryFields").hidden = method !== "delivery";
  document.getElementById("carrierFields").hidden = method !== "carrier";
  document.getElementById("pickupFields").hidden = method !== "pickup";
}

document.getElementById("vatRequested").addEventListener("change", (e) => {
  document.getElementById("vatFields").hidden = !e.target.checked;
});

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
  const c = getCurrentCustomer();
  if (c.id === "guest") {
    alert("Vui lòng đăng nhập bằng tài khoản đối tác sỉ trước khi đặt hàng.");
    openLoginModal();
    return;
  }
  goToStep(3);
});

// ===== VIEW NAVIGATION (menu ngang: Đặt hàng / Theo dõi / Công nợ / Lịch sử / Ưu đãi) =====
const VIEWS = ["order", "track", "debt", "history", "offers", "profile"];
function showView(view) {
  VIEWS.forEach(v => document.getElementById("view-" + v).classList.toggle("active", v === view));
  document.querySelectorAll(".nav-link").forEach(a => a.classList.toggle("active", a.dataset.view === view));
  if (view === "track") renderTrackView();
  if (view === "debt") renderDebtView();
  if (view === "history") renderHistoryView();
  if (view === "offers") renderOffersView();
  if (view === "profile") renderProfileView();
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

// ===== VALIDATION trước khi sang bước Xác nhận đơn hàng =====
const DELIVERY_METHOD_LABEL = { delivery: "Giao tận nơi", carrier: "Gửi qua chành xe", pickup: "Khách đến lấy tại kho" };
const PAYMENT_LABEL = { transfer: "Chuyển khoản", cash: "Tiền mặt khi giao", debt: "Công nợ" };

function showFormError(messages) {
  const el = document.getElementById("formError");
  if (!messages.length) { el.hidden = true; el.textContent = ""; return; }
  el.hidden = false;
  el.textContent = messages.map(m => "• " + m).join("\n");
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildDraftOrderFromForm() {
  const errors = [];
  const customer = getCurrentCustomer();
  const lines = getCartLines();

  if (customer.id === "guest") errors.push("Bạn cần đăng nhập bằng tài khoản đối tác sỉ.");
  if (lines.length === 0) errors.push("Giỏ hàng đang trống.");

  const company = document.getElementById("custCompany").value.trim();
  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const deliveryDate = document.getElementById("deliveryDate").value;
  const deliveryMethod = document.querySelector('input[name="deliveryMethod"]:checked')?.value;
  const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value;
  const note = document.getElementById("custNote").value.trim();
  const vatRequested = document.getElementById("vatRequested").checked;
  const tax = document.getElementById("custTax").value.trim();

  if (!company) errors.push("Thiếu tên công ty / cửa hàng.");
  if (!name) errors.push("Thiếu tên người liên hệ.");
  if (!phone || !/^[0-9]{9,11}$/.test(phone)) errors.push("Số điện thoại không hợp lệ.");
  if (!deliveryDate) errors.push("Vui lòng chọn ngày giao hàng.");
  else if (deliveryDate < todayISO()) errors.push("Ngày giao hàng không được ở quá khứ.");
  if (!deliveryMethod) errors.push("Vui lòng chọn hình thức nhận hàng.");
  if (!paymentMethod) errors.push("Vui lòng chọn phương thức thanh toán.");

  let deliveryDetails = {};
  if (deliveryMethod === "delivery") {
    const address = document.getElementById("custAddress").value.trim();
    if (!address) errors.push("Vui lòng nhập địa chỉ giao hàng.");
    deliveryDetails = { address };
  } else if (deliveryMethod === "carrier") {
    const carrierName = document.getElementById("carrierName").value.trim();
    const carrierNote = document.getElementById("carrierNote").value.trim();
    if (!carrierName) errors.push("Vui lòng nhập tên nhà xe / chành xe.");
    deliveryDetails = { carrierName, carrierNote };
  } else if (deliveryMethod === "pickup") {
    const pickupLocation = document.getElementById("pickupLocation").value;
    const loc = PICKUP_LOCATIONS.find(l => l.id === pickupLocation);
    deliveryDetails = { pickupLocation: loc ? loc.name : pickupLocation };
  }

  if (vatRequested && !tax) errors.push("Đã chọn xuất VAT nhưng chưa nhập mã số thuế.");

  const total = getCartTotal();
  if (paymentMethod === "debt") {
    if (customer.id === "guest") errors.push("Cần đăng nhập để sử dụng công nợ.");
    else {
      const projected = getDebt(customer.id) + total;
      if (projected > customer.debtLimit) {
        errors.push(`Đơn hàng vượt hạn mức công nợ (hạn mức ${money(customer.debtLimit)}, đã dùng ${money(getDebt(customer.id))}).`);
      }
    }
  }

  // Kiểm tra lại tồn kho tại thời điểm này (đề phòng thay đổi khi đang điền form)
  lines.forEach(l => {
    if (getStock(l.id) < l.qty) errors.push(`"${l.name}" chỉ còn ${fmtQty(getStock(l.id), l.unit)}, không đủ ${fmtQty(l.qty, l.unit)} trong giỏ.`);
  });

  if (errors.length) return { errors };

  const paymentStatus = paymentMethod === "transfer" ? "cho_thanh_toan" : paymentMethod === "cash" ? "tien_mat_khi_giao" : "cong_no";

  return {
    errors: [],
    draft: {
      customerId: customer.id,
      company, name, phone, tax, vatRequested,
      deliveryDate, deliveryMethod,
      deliveryMethodLabel: DELIVERY_METHOD_LABEL[deliveryMethod],
      deliveryDetails, note,
      paymentMethod, paymentLabel: PAYMENT_LABEL[paymentMethod], paymentStatus,
      lines, subtotal: getCartSubtotal(), discount: getCartDiscountTotal(), total,
    },
  };
}

document.getElementById("checkoutForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const { errors, draft } = buildDraftOrderFromForm();
  if (errors.length) { showFormError(errors); return; }
  showFormError([]);
  draftOrder = draft;
  renderReviewScreen(draftOrder);
  goToStep(4);
});

// ===== STEP 4: REVIEW (XÁC NHẬN ĐƠN HÀNG trước khi tạo) =====
function deliveryDetailsHtml(d) {
  if (d.deliveryMethod === "delivery") return `<div class="review-row"><span>Địa chỉ giao hàng</span><span>${d.deliveryDetails.address}</span></div>`;
  if (d.deliveryMethod === "carrier") return `
    <div class="review-row"><span>Tên nhà xe</span><span>${d.deliveryDetails.carrierName}</span></div>
    <div class="review-row"><span>Thông tin nhận hàng</span><span>${d.deliveryDetails.carrierNote || "—"}</span></div>`;
  if (d.deliveryMethod === "pickup") return `<div class="review-row"><span>Điểm nhận hàng</span><span>${d.deliveryDetails.pickupLocation}</span></div>`;
  return "";
}

function renderReviewScreen(d) {
  document.getElementById("reviewContent").innerHTML = `
    <h4>Khách hàng</h4>
    <div class="review-row"><span>Công ty / cửa hàng</span><span>${d.company}</span></div>
    <div class="review-row"><span>Người liên hệ</span><span>${d.name}</span></div>
    <div class="review-row"><span>Số điện thoại</span><span>${d.phone}</span></div>

    <h4>Sản phẩm</h4>
    ${d.lines.map(l => `<div class="review-line"><span>${l.name} × ${fmtQty(l.qty, l.unit)} (${money(l.unitPrice)}/${l.unit}${l.rate > 0 ? `, -${Math.round(l.rate * 100)}%` : ""})</span><span>${money(l.lineTotal)}</span></div>`).join("")}
    <div class="review-row"><span>Tạm tính</span><span>${money(d.subtotal)}</span></div>
    <div class="review-row"><span>Chiết khấu</span><span>-${money(d.discount)}</span></div>
    <div class="review-row" style="font-weight:800;font-size:1.05rem;"><span>Tổng tiền</span><span>${money(d.total)}</span></div>

    <h4>Giao hàng & Thanh toán</h4>
    <div class="review-row"><span>Ngày giao hàng</span><span>${d.deliveryDate}</span></div>
    <div class="review-row"><span>Hình thức nhận hàng</span><span>${d.deliveryMethodLabel}</span></div>
    ${deliveryDetailsHtml(d)}
    <div class="review-row"><span>Phương thức thanh toán</span><span>${d.paymentLabel}</span></div>
    <div class="review-row"><span>Xuất hoá đơn VAT</span><span>${d.vatRequested ? `Có (MST: ${d.tax})` : "Không"}</span></div>
    <div class="review-row"><span>Ghi chú</span><span>${d.note || "—"}</span></div>
  `;
}

// Chữ ký đơn nháp để chống tạo trùng khi bấm nhiều lần / mạng chậm / refresh
function computeOrderSignature(d) {
  const linePart = d.lines.map(l => `${l.id}:${l.qty}`).join(",");
  return [d.customerId, linePart, d.deliveryDate, d.deliveryMethod, d.paymentMethod, d.total].join("|");
}

document.getElementById("confirmOrderBtn").addEventListener("click", () => {
  if (isSubmittingOrder) return; // chặn double-click
  if (!draftOrder) { goToStep(1); return; }

  // Chống tạo đơn trùng nếu vừa tạo đơn giống hệt trong 60 giây gần nhất
  // (bấm nhiều lần / refresh giữa chừng / request gửi lại).
  const signature = computeOrderSignature(draftOrder);
  const lastSig = JSON.parse(sessionStorage.getItem("tucaphe_last_order_sig_b2b") || "null");
  if (lastSig && lastSig.signature === signature && Date.now() - lastSig.time < 60000) {
    const existing = getAllHistory().find(o => o.id === lastSig.orderId);
    if (existing) {
      renderConfirmation(existing);
      goToStep(5);
      return;
    }
  }

  isSubmittingOrder = true;
  const btn = document.getElementById("confirmOrderBtn");
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Đang xử lý...";

  // Kiểm tra tồn kho lần cuối ngay trước khi tạo đơn thật
  const stockErrors = [];
  draftOrder.lines.forEach(l => {
    if (getStock(l.id) < l.qty) stockErrors.push(`"${l.name}" chỉ còn ${fmtQty(getStock(l.id), l.unit)}.`);
  });
  if (stockErrors.length) {
    isSubmittingOrder = false;
    btn.disabled = false;
    btn.textContent = originalText;
    alert("Không thể tạo đơn — tồn kho vừa thay đổi:\n" + stockErrors.join("\n"));
    goToStep(2);
    return;
  }

  const orderId = nextOrderId();
  const order = {
    id: orderId,
    ...draftOrder,
    debtSettled: draftOrder.paymentMethod !== "debt",
    createdAt: new Date().toISOString(),
    status: "pending", // 🟡 Chờ xác nhận
  };

  draftOrder.lines.forEach(l => { stock[l.id] = Math.max(0, getStock(l.id) - l.qty); });
  saveStock();
  renderStockTable();

  if (order.paymentMethod === "debt") addDebt(order.customerId, order.total);

  saveOrderToHistory(order);
  sessionStorage.setItem("tucaphe_last_order_sig_b2b", JSON.stringify({ signature, orderId, time: Date.now() }));

  lastOrder = order;
  renderConfirmation(order);
  cart = {};
  saveCart();
  updateCartCount();
  renderProductGrid();
  renderCustomerDashboard();
  goToStep(5);
  simulateOrderProgress(order.id);

  draftOrder = null;
  isSubmittingOrder = false;
  btn.disabled = false;
  btn.textContent = originalText;
});

// ===== CONFIRMATION RENDER (bước 5 — đơn đã được tạo) =====
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
    <div><span>Ngày giao hàng</span><span>${order.deliveryDate}</span></div>
    <div><span>Hình thức nhận hàng</span><span>${order.deliveryMethodLabel}</span></div>
    <div><span>Thanh toán</span><span>${order.paymentLabel} — ${PAYMENT_STATUS_LABEL[order.paymentStatus]}</span></div>
    ${order.vatRequested ? `<div><span>Xuất VAT</span><span>MST: ${order.tax}</span></div>` : ""}
  `;
  updateStatusTrack(order.status);
}

const STATUS_FLOW = ["pending", "confirmed", "preparing", "delivering", "delivered"];
const STATUS_LABEL = {
  pending: "🟡 Chờ xác nhận", confirmed: "🔵 Đã xác nhận", preparing: "🟠 Đang chuẩn bị",
  delivering: "🟣 Đang giao", delivered: "🟢 Đã giao", cancelled: "🔴 Đã hủy",
};
const PAYMENT_STATUS_LABEL = {
  cho_thanh_toan: "Chờ thanh toán", da_thanh_toan: "Đã thanh toán",
  tien_mat_khi_giao: "Tiền mặt khi giao", cong_no: "Công nợ",
};

function updateStatusTrack(status) {
  const idx = STATUS_FLOW.indexOf(status);
  document.querySelectorAll("#orderStatusTrack .status-step").forEach(el => {
    const elIdx = STATUS_FLOW.indexOf(el.dataset.status);
    el.classList.remove("done", "current");
    if (status === "cancelled") return; // giữ nguyên track, trạng thái hủy hiển thị riêng ở nơi khác
    if (elIdx < idx) el.classList.add("done");
    else if (elIdx === idx) el.classList.add(idx === STATUS_FLOW.length - 1 ? "done" : "current");
  });
}

function simulateOrderProgress(orderId) {
  let i = 0;
  const interval = setInterval(() => {
    const current = getAllHistory().find(o => o.id === orderId);
    if (!current || current.status === "cancelled") { clearInterval(interval); return; }
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
  localStorage.setItem("tucaphe_orders_b2b", JSON.stringify(history.slice(0, 200)));
}
function updateOrderStatusInHistory(orderId, status) {
  const history = getAllHistory();
  const o = history.find(h => h.id === orderId);
  if (o) { o.status = status; localStorage.setItem("tucaphe_orders_b2b", JSON.stringify(history)); }
}

function historyRowHtml(o, { reorder, cancel } = {}) {
  const canCancel = cancel && (o.status === "pending" || o.status === "confirmed");
  return `
    <div class="history-item">
      <span class="hid">#${o.id}</span>
      <span>Đặt: ${new Date(o.createdAt).toLocaleDateString("vi-VN")} · Giao: ${o.deliveryDate || "—"}</span>
      <span>${o.lines.length} sản phẩm · ${money(o.total)}</span>
      <span class="history-badge">${STATUS_LABEL[o.status] || o.status}</span>
      <span class="history-badge">${PAYMENT_STATUS_LABEL[o.paymentStatus] || o.payment || ""}</span>
      ${reorder ? `<button class="btn secondary sm" data-reorder="${o.id}">🔄 Đặt lại</button>` : ""}
      ${canCancel ? `<button class="btn danger sm" data-cancel="${o.id}">✕ Hủy đơn</button>` : ""}
    </div>`;
}

// ===== VIEW: THEO DÕI ĐƠN =====
function renderTrackView() {
  const container = document.getElementById("trackList");
  const c = getCurrentCustomer();
  if (c.id === "guest") { container.innerHTML = `<div class="empty-msg">Đăng nhập để theo dõi đơn hàng của bạn.</div>`; return; }
  const orders = getCustomerHistory(c.id).filter(o => o.status !== "delivered" && o.status !== "cancelled");
  container.innerHTML = orders.length
    ? orders.map(o => historyRowHtml(o, { cancel: true })).join("")
    : `<div class="empty-msg">Bạn không có đơn hàng nào đang xử lý.</div>`;
  container.querySelectorAll("[data-cancel]").forEach(btn => {
    btn.addEventListener("click", () => cancelOrder(btn.dataset.cancel));
  });
}

function cancelOrder(orderId) {
  if (!confirm(`Xác nhận hủy đơn #${orderId}?`)) return;
  const history = getAllHistory();
  const o = history.find(h => h.id === orderId);
  if (!o || (o.status !== "pending" && o.status !== "confirmed")) return;
  o.status = "cancelled";
  localStorage.setItem("tucaphe_orders_b2b", JSON.stringify(history));
  if (o.paymentMethod === "debt" && !o.debtSettled) reduceDebt(o.customerId, o.total);
  renderTrackView();
  renderCustomerDashboard();
}

// ===== VIEW: LỊCH SỬ MUA HÀNG (có nút Đặt lại) =====
function renderHistoryView() {
  const container = document.getElementById("historyList");
  const c = getCurrentCustomer();
  if (c.id === "guest") { container.innerHTML = `<div class="empty-msg">Đăng nhập để xem lịch sử mua hàng của bạn.</div>`; return; }
  const orders = getCustomerHistory(c.id);
  if (!orders.length) { container.innerHTML = `<div class="empty-msg">Bạn chưa có đơn hàng nào.</div>`; return; }
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
    const p = PRODUCTS.find(pr => pr.id === l.id);
    if (!p || !isOrderable(p)) { unavailable.push(`${l.name} (không còn kinh doanh / chưa có giá)`); return; }
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
  alert("Đã đưa sản phẩm từ đơn cũ vào giỏ hàng. Vui lòng kiểm tra và XÁC NHẬN lại đơn mới.");
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
  if (c.debtLimit <= 0) {
    summary.innerHTML = `<div class="empty-msg">Tài khoản của bạn chưa được cấp hạn mức công nợ. Vui lòng liên hệ Tú Cà Phê nếu cần sử dụng hình thức này.</div>`;
    list.innerHTML = "";
    return;
  }
  const used = getDebt(c.id);
  const limit = c.debtLimit;
  const remain = Math.max(0, limit - used);
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  summary.innerHTML = `
    <div class="debt-cards">
      <div class="debt-card"><span>Hạn mức công nợ</span><strong>${money(limit)}</strong></div>
      <div class="debt-card"><span>Đã sử dụng (tổng công nợ)</span><strong class="danger">${money(used)}</strong></div>
      <div class="debt-card"><span>Còn phải trả</span><strong class="danger">${money(used)}</strong></div>
      <div class="debt-card"><span>Còn lại có thể dùng</span><strong class="success">${money(remain)}</strong></div>
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
  `;
  const debtOrders = getCustomerHistory(c.id).filter(o => o.paymentMethod === "debt" && o.status !== "cancelled");
  if (!debtOrders.length) { list.innerHTML = `<div class="empty-msg">Chưa có đơn công nợ nào.</div>`; return; }
  list.innerHTML = debtOrders.map(o => `
    <div class="history-item">
      <span class="hid">#${o.id}</span>
      <span>${new Date(o.createdAt).toLocaleDateString("vi-VN")}</span>
      <span>${money(o.total)}</span>
      <span class="history-badge">${o.debtSettled ? "Đã thanh toán" : "Chưa thanh toán"}</span>
      ${!o.debtSettled ? `<button class="btn primary sm" data-paydebt="${o.id}">💵 Đánh dấu đã thanh toán</button>` : ""}
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
  o.paymentStatus = "da_thanh_toan";
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

// ===== VIEW: TÀI KHOẢN CỦA TÔI (hồ sơ khách hàng) =====
function profileRow(label, value) {
  return `<div class="review-row"><span>${label}</span><span>${value || "—"}</span></div>`;
}
function renderProfileView(editMode = false) {
  const c = getCurrentCustomer();
  const el = document.getElementById("profileContent");
  if (c.id === "guest") {
    el.innerHTML = `<div class="empty-msg">Vui lòng đăng nhập để xem tài khoản của bạn.</div>`;
    return;
  }

  if (!editMode) {
    el.innerHTML = `
      <div class="review-box">
        <h4>Thông tin tài khoản</h4>
        ${profileRow("Customer ID", c.id)}
        ${profileRow("Trạng thái", `<span class="status-pill ${c.status}">${CUSTOMER_STATUS_LABEL[c.status] || c.status}</span>`)}
        ${profileRow("Họ và tên", c.name)}
        ${profileRow("Tên quán / doanh nghiệp", c.company)}
        ${profileRow("Số điện thoại", c.phone)}
        ${profileRow("Email", c.email)}
        ${profileRow("Địa chỉ giao hàng", c.address)}
      </div>
      <div class="panel-actions">
        <button class="btn secondary" id="profileEditBtn">Chỉnh sửa thông tin</button>
        <button class="btn danger" id="profileLogoutBtn">Đăng xuất</button>
      </div>
    `;
    document.getElementById("profileEditBtn").addEventListener("click", () => renderProfileView(true));
    document.getElementById("profileLogoutBtn").addEventListener("click", () => {
      setCurrentCustomer("guest");
      showView("order");
    });
  } else {
    el.innerHTML = `
      <form id="profileEditForm" class="checkout-form review-box">
        <h4>Chỉnh sửa thông tin</h4>
        <label>Họ và tên
          <input type="text" id="editName" value="${c.name || ""}" required>
        </label>
        <label>Tên quán / doanh nghiệp
          <input type="text" id="editCompany" value="${c.company || ""}">
        </label>
        <label>Email
          <input type="email" id="editEmail" value="${c.email || ""}">
        </label>
        <label>Địa chỉ giao hàng
          <input type="text" id="editAddress" value="${c.address || ""}">
        </label>
        <div class="panel-actions">
          <button type="button" class="btn secondary" id="profileCancelBtn">Huỷ</button>
          <button type="submit" class="btn primary">Lưu thay đổi</button>
        </div>
      </form>
    `;
    document.getElementById("profileCancelBtn").addEventListener("click", () => renderProfileView(false));
    document.getElementById("profileEditForm").addEventListener("submit", (e) => {
      e.preventDefault();
      updateCustomerProfile(c.id, {
        name: document.getElementById("editName").value.trim(),
        company: document.getElementById("editCompany").value.trim(),
        email: document.getElementById("editEmail").value.trim(),
        address: document.getElementById("editAddress").value.trim(),
      });
      updateCustomerBadge();
      renderCustomerDashboard();
      renderProfileView(false);
    });
  }
}

// ===== STOCK MODAL =====
function renderStockTable() {
  const body = document.getElementById("stockTableBody");
  body.innerHTML = PRODUCTS.map(p => {
    const qty = hasValidStock(p) ? getStock(p.id) : null;
    const priceText = hasValidPrice(p) ? `${money(p.price)}/${p.unit}` : `<span class="no-price">Chưa cập nhật</span>`;
    let stockText;
    if (!hasValidStock(p)) stockText = `<span class="stock-badge low">Chưa cập nhật</span>`;
    else if (qty <= 0) stockText = '<span class="stock-badge out">Hết hàng</span>';
    else if (qty <= p.minOrder * 2) stockText = `<span class="stock-badge low">${fmtQty(qty, p.unit)}</span>`;
    else stockText = fmtQty(qty, p.unit);
    return `
    <tr>
      <td>${p.icon} ${p.name}</td>
      <td>${CAT_NAME[p.cat]}</td>
      <td>${priceText}</td>
      <td>${stockText}</td>
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

// ===== LOGIN / ĐĂNG KÝ MODAL =====
const loginModal = document.getElementById("loginModal");
function showLoginError(message) {
  const el = document.getElementById("loginError");
  if (!message) { el.hidden = true; el.textContent = ""; return; }
  el.hidden = false;
  el.textContent = message;
}
function switchAuthTab(tab) {
  document.querySelectorAll(".auth-tab").forEach(btn => btn.classList.toggle("active", btn.dataset.authtab === tab));
  document.getElementById("loginPane").hidden = tab !== "login";
  document.getElementById("registerPane").hidden = tab !== "register";
  showLoginError("");
  showRegisterMessage("");
}
document.querySelectorAll(".auth-tab").forEach(btn => {
  btn.addEventListener("click", () => switchAuthTab(btn.dataset.authtab));
});

function openLoginModal(tab = "login") {
  switchAuthTab(tab);
  loginModal.classList.add("open");
  overlay.classList.add("show");
}
function closeLoginModal() { loginModal.classList.remove("open"); overlay.classList.remove("show"); }
document.getElementById("customerBtn").addEventListener("click", () => {
  if (getCurrentCustomer().id === "guest") openLoginModal("login");
  else showView("profile");
});
document.getElementById("closeLoginModal").addEventListener("click", closeLoginModal);

document.getElementById("loginSubmitBtn").addEventListener("click", () => {
  const phone = document.getElementById("loginPhone").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!phone || !password) {
    showLoginError("Vui lòng nhập đầy đủ số điện thoại và mật khẩu.");
    return;
  }

  const found = authenticateCustomer(phone, password);
  if (!found) {
    showLoginError("Số điện thoại hoặc mật khẩu không chính xác.");
    return;
  }
  if (found.status === CUSTOMER_STATUS.PENDING) {
    showLoginError("Tài khoản của bạn đang chờ Tú Cà Phê xác nhận.");
    return;
  }
  if (found.status === CUSTOMER_STATUS.BLOCKED) {
    showLoginError("Tài khoản hiện đang bị khóa. Vui lòng liên hệ Tú Cà Phê.");
    return;
  }

  showLoginError("");
  setCurrentCustomer(found.id);
  document.getElementById("loginPhone").value = "";
  document.getElementById("loginPassword").value = "";
  closeLoginModal();
});
document.getElementById("logoutBtn").addEventListener("click", () => {
  setCurrentCustomer("guest");
  showLoginError("");
  closeLoginModal();
  showView("order");
});
function updateCustomerBadge() {
  const c = getCurrentCustomer();
  document.getElementById("customerNameTag").textContent = c.id === "guest" ? "Đăng nhập" : c.name;
}

// ===== ĐĂNG KÝ TÀI KHOẢN MỚI =====
function showRegisterMessage(errorMsg, successMsg) {
  const errEl = document.getElementById("registerError");
  const okEl = document.getElementById("registerSuccess");
  errEl.hidden = !errorMsg; errEl.textContent = errorMsg || "";
  okEl.hidden = !successMsg; okEl.textContent = successMsg || "";
}

document.getElementById("registerForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("regName").value.trim();
  const company = document.getElementById("regCompany").value.trim();
  const phone = document.getElementById("regPhone").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const address = document.getElementById("regAddress").value.trim();
  const password = document.getElementById("regPassword").value;
  const passwordConfirm = document.getElementById("regPasswordConfirm").value;

  const errors = [];
  if (!name) errors.push("Vui lòng nhập họ và tên.");
  if (!company) errors.push("Vui lòng nhập tên quán / doanh nghiệp.");
  if (!phone || !/^[0-9]{9,11}$/.test(phone)) errors.push("Số điện thoại không hợp lệ.");
  else if (isPhoneRegistered(phone)) errors.push("Số điện thoại này đã được đăng ký. Vui lòng đăng nhập.");
  if (!address) errors.push("Vui lòng nhập địa chỉ giao hàng.");
  if (!password || password.length < 6) errors.push("Mật khẩu phải có ít nhất 6 ký tự.");
  if (password !== passwordConfirm) errors.push("Mật khẩu xác nhận không khớp.");

  if (errors.length) { showRegisterMessage(errors.join(" ")); return; }

  const record = registerCustomer({ name, company, phone, email, address, password });
  showRegisterMessage("", `Đăng ký thành công! Mã khách hàng của bạn: ${record.id}. Tài khoản đang chờ Tú Cà Phê xác nhận — bạn sẽ đăng nhập được sau khi được duyệt.`);
  document.getElementById("registerForm").reset();
});

// ===== DASHBOARD SAU ĐĂNG NHẬP (thay cho hero khi đã có khách hàng) =====
function renderCustomerDashboard() {
  const c = getCurrentCustomer();
  const dash = document.getElementById("customerDashboard");
  const hero = document.getElementById("heroBlock");
  if (c.id === "guest") {
    dash.classList.remove("show");
    hero.style.display = "";
    return;
  }
  hero.style.display = "none";
  const orders = getCustomerHistory(c.id);
  const activeOrders = orders.filter(o => o.status !== "delivered" && o.status !== "cancelled");
  const recent = orders[0];
  const debt = getDebt(c.id);

  dash.innerHTML = `
    <h2>Xin chào, ${c.name}!</h2>
    <p class="tier-line">${c.company ? c.company + " · " : ""}${c.tier} · Giá sỉ riêng ${Math.round(c.discount * 100)}%</p>
    <div class="dash-grid">
      <div class="dash-card"><span>Đơn đang xử lý</span><strong>${activeOrders.length}</strong></div>
      <div class="dash-card"><span>Đơn gần đây</span><strong>${recent ? "#" + recent.id : "—"}</strong></div>
      ${c.debtLimit > 0 ? `<div class="dash-card"><span>Công nợ hiện tại</span><strong>${money(debt)}</strong></div>` : ""}
    </div>
    <div class="dash-actions">
      <button class="pill-btn solid lg" id="dashOrderBtn">Đặt hàng ngay →</button>
      ${recent ? `<button class="pill-btn outline lg" id="dashReorderBtn">🔄 Đặt lại đơn gần nhất (#${recent.id})</button>` : ""}
    </div>
  `;
  dash.classList.add("show");

  document.getElementById("dashOrderBtn").addEventListener("click", () => {
    document.getElementById("productGrid").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  const reorderBtn = document.getElementById("dashReorderBtn");
  if (reorderBtn) reorderBtn.addEventListener("click", () => reorderOrder(recent.id));
}

// =====================================================================
// KIẾN TRÚC KẾT NỐI BACKEND / LARK BASE (chưa triển khai — thiết kế sẵn)
// =====================================================================
// Luồng dự kiến: WEB APP → API (backend riêng, giữ API key) → Lark Base → Claude/MCP → Automation → Nhân viên
// Frontend KHÔNG được giữ API key/token của Lark. Mọi lời gọi Lark phải đi qua
// một backend trung gian (ví dụ: Cloudflare Worker / Node server) mà frontend
// gọi bằng fetch() tới endpoint nội bộ, không gọi thẳng Lark API.
//
// Khi tạo đơn thành công (trong document.getElementById("confirmOrderBtn") ở trên),
// gọi thêm: submitOrderToBackend(order) — hiện là placeholder an toàn, CHƯA gọi
// mạng thật, chỉ log ra console để dễ kiểm tra cấu trúc dữ liệu.
function mapOrderToLarkRows(order) {
  // Mỗi dòng sản phẩm trong đơn = 1 dòng trong bảng "01 – NHẬT KÝ BÁN HÀNG".
  // Field name giữ đúng tiếng Việt như Lark Base hiện có — KHÔNG tự đổi tên.
  // Chỉ ghi nhận GIAO DỊCH BÁN HÀNG — không tự tạo giao dịch kho cà phê,
  // không tự tạo yêu cầu VAT nếu khách không chọn.
  return order.lines.map(l => ({
    "Giao Dịch": order.id,
    "Khách Hàng": order.company || order.name,
    "Sản phẩm": l.name,
    "Loại giao dịch": "Bán hàng",
    "Ngày": order.createdAt,
    "Số lượng": l.qty,
    "Đơn giá": l.unitPrice,
    "Thành tiền": l.lineTotal,
    "Thanh Toán": PAYMENT_STATUS_LABEL[order.paymentStatus] || order.paymentStatus,
    "Ngày giao hàng": order.deliveryDate,
    "Hình thức nhận hàng": order.deliveryMethodLabel,
    "Trạng thái giao hàng": STATUS_LABEL[order.status] || order.status,
    "Ghi chú": order.note || "",
    "Tệp đính kèm": null,
    ...(order.vatRequested ? { "Yêu cầu VAT": true, "MST": order.tax } : {}),
  }));
}

async function submitOrderToBackend(order) {
  // TODO: thay bằng lời gọi thật khi có backend, ví dụ:
  // const res = await fetch("/api/orders", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ order, larkRows: mapOrderToLarkRows(order) }),
  // });
  // if (!res.ok) throw new Error("Không thể ghi nhận đơn lên hệ thống trung tâm.");
  // return res.json();
  console.info("[Lark rows - CHƯA gửi, chưa có backend]", mapOrderToLarkRows(order));
  return null;
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
  renderCustomerDashboard();
  updateDeliveryFieldsVisibility();
  showView("order");
  goToStep(1);
}
init();
