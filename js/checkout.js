// ===== MÃ ĐƠN HÀNG: TCP-000001, TCP-000002... =====
const ORDER_SEQ_KEY = "tcp_order_seq_v1";
function nextOrderId() {
  const seq = parseInt(localStorage.getItem(ORDER_SEQ_KEY) || "0", 10) + 1;
  localStorage.setItem(ORDER_SEQ_KEY, String(seq));
  return "TCP-" + String(seq).padStart(6, "0");
}

// ===== NHẬT KÝ ĐƠN HÀNG CỤC BỘ (dùng cho trang Admin xem tạm khi CHƯA có backend) =====
const ORDERS_LOG_KEY = "tcp_orders_local_v1";
function saveOrderLocally(order) {
  const list = JSON.parse(localStorage.getItem(ORDERS_LOG_KEY) || "[]");
  list.unshift(order);
  localStorage.setItem(ORDERS_LOG_KEY, JSON.stringify(list.slice(0, 300)));
}

function cartStatusHtml(cart) {
  const lines = buildCartLines(cart);
  if (!lines.length) return `<div class="cart-status-banner empty">Giỏ hàng của bạn đang trống. <a href="products.html">Xem sản phẩm →</a></div>`;

  // Giá sỉ chỉ áp dụng cho cà phê — bỏ qua thiết bị khi tính banner này.
  const coffeeLines = lines.filter(l => l.category_id === "ca-phe");
  if (!coffeeLines.length) return "";

  const totalKg = getCartTotalKg(cart);
  const nearestThreshold = Math.min(...coffeeLines.map(l => l.wholesale_min_kg));
  const allWholesale = coffeeLines.every(l => l.isWholesale);
  if (allWholesale) return `<div class="cart-status-banner eligible">✓ Đang áp dụng giá sỉ cho toàn bộ cà phê trong đơn.</div>`;
  if (totalKg >= nearestThreshold) return `<div class="cart-status-banner eligible">✓ Một số sản phẩm cà phê trong giỏ đã được áp dụng giá sỉ.</div>`;
  return `<div class="cart-status-banner progress">Mua thêm ${nearestThreshold - totalKg}kg cà phê để được áp dụng giá sỉ (từ ${nearestThreshold}kg).</div>`;
}

function renderCart() {
  const cart = loadCart();
  const lines = buildCartLines(cart);
  document.getElementById("cartStatusBanner").innerHTML = cartStatusHtml(cart);

  document.getElementById("cartItems").innerHTML = lines.map(l => `
    <div class="cart-item">
      <div class="cart-item-icon">${l.icon}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${l.name}</div>
        <div class="cart-item-price">${l.category_id === "combo" ? money(l.unitPrice) + "/bộ" : money(l.unitPrice) + "/" + l.unit + (l.category_id === "ca-phe" ? (l.isWholesale ? " (giá sỉ)" : " (giá lẻ)") : "")}</div>
      </div>
      <div class="cart-item-qty">
        <button data-dec="${l.id}">−</button>
        <span>${l.qty} ${l.unit}</span>
        <button data-inc="${l.id}">+</button>
      </div>
      <div class="cart-item-total">${money(l.lineTotal)}</div>
      <button class="remove-btn" data-remove="${l.id}">🗑️</button>
    </div>
  `).join("");

  const totalKg = getCartTotalKg(cart);
  const totalMoney = getCartTotal(cart);
  document.getElementById("cartSummary").style.display = lines.length ? "block" : "none";
  document.getElementById("cartTotalKg").textContent = totalKg + "kg";
  document.getElementById("cartTotalMoney").textContent = money(totalMoney);
  document.getElementById("checkoutForm").style.display = lines.length ? "flex" : "none";

  document.querySelectorAll("[data-inc]").forEach(b => b.addEventListener("click", () => {
    const c = loadCart(); setCartQty(b.dataset.inc, (c[b.dataset.inc] || 0) + 1); renderCart();
  }));
  document.querySelectorAll("[data-dec]").forEach(b => b.addEventListener("click", () => {
    const c = loadCart(); setCartQty(b.dataset.dec, Math.max(0, (c[b.dataset.dec] || 0) - 1)); renderCart();
  }));
  document.querySelectorAll("[data-remove]").forEach(b => b.addEventListener("click", () => {
    removeFromCart(b.dataset.remove); renderCart();
  }));
}

function showFormError(msg) {
  const el = document.getElementById("formError");
  el.style.display = msg ? "block" : "none";
  el.textContent = msg || "";
}

let isSubmitting = false;
document.getElementById("checkoutForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (isSubmitting) return;

  const cart = loadCart();
  const lines = buildCartLines(cart);
  if (!lines.length) { showFormError("Giỏ hàng đang trống."); return; }

  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const company = document.getElementById("custCompany").value.trim();
  const address = document.getElementById("custAddress").value.trim();
  const province = document.getElementById("custProvince").value.trim();
  const note = document.getElementById("custNote").value.trim();

  const errors = [];
  if (!name) errors.push("Vui lòng nhập họ và tên.");
  if (!phone || !/^[0-9]{9,11}$/.test(phone)) errors.push("Số điện thoại không hợp lệ.");
  if (!address) errors.push("Vui lòng nhập địa chỉ nhận hàng.");
  if (!province) errors.push("Vui lòng nhập tỉnh/thành.");
  lines.forEach(l => {
    if (isInStock(l) && l.qty > l.stock) errors.push(`"${l.name}" chỉ còn ${l.stock}${l.unit} trong kho.`);
  });
  if (errors.length) { showFormError(errors.join(" ")); return; }
  showFormError("");

  isSubmitting = true;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Đang xử lý...";

  const totalKg = getCartTotalKg(cart);
  const orderTotal = getCartTotal(cart);
  const orderId = nextOrderId();
  const order = {
    id: orderId,
    createdAt: new Date().toISOString(),
    customerName: name, customerPhone: phone, customerCompany: company,
    address, province, note,
    lines: lines.map(l => ({
      productId: l.id, name: l.name, unit: l.unit, qty: l.qty,
      unitPrice: l.unitPrice, lineTotal: l.lineTotal,
      priceType: l.isWholesale ? "wholesale" : "retail",
    })),
    totalKg, total: orderTotal,
    status: "Mới",
  };

  // ===== GỬI ĐƠN VỀ BACKEND (Cloudflare Worker) → LARK BASE =====
  // Backend thật CHƯA được triển khai (cần bạn deploy Worker theo worker/README.md
  // và cập nhật ORDER_API_URL bên dưới). Trong lúc chờ, đơn được lưu tạm cục bộ để
  // có thể test đầy đủ luồng đặt hàng ngay hôm nay — KHÔNG gọi thẳng Lark API từ đây.
  const ORDER_API_URL = "/api/orders"; // TODO: thay bằng URL Cloudflare Worker khi đã deploy
  let syncedToBackend = false;
  try {
    const res = await fetch(ORDER_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    syncedToBackend = res.ok;
  } catch (err) {
    syncedToBackend = false; // chưa có backend — dự kiến sẽ lỗi cho đến khi Phase 7-8 hoàn tất
  }
  order.syncedToBackend = syncedToBackend;
  saveOrderLocally(order);
  upsertCustomerFromOrder(order);

  // Trừ tồn kho cục bộ (demo) — khi có backend thật, việc trừ kho phải do backend xử lý.
  const products = loadProducts();
  lines.forEach(l => {
    const p = products.find(pr => pr.id === l.id);
    if (p && isInStock(p)) p.stock = Math.max(0, p.stock - l.qty);
  });
  saveProducts(products);

  clearCart();
  showSuccess(order);

  isSubmitting = false;
  submitBtn.disabled = false;
  submitBtn.textContent = originalText;
});

function showSuccess(order) {
  document.getElementById("cartView").style.display = "none";
  document.getElementById("successView").style.display = "block";
  document.getElementById("successOrderId").textContent = "Mã đơn hàng: " + order.id;
  document.getElementById("successReceipt").innerHTML = `
    ${order.lines.map(l => `<div><span>${l.name} × ${l.qty} ${l.unit}</span><span>${money(l.lineTotal)}</span></div>`).join("")}
    <div><span>Tổng khối lượng</span><span>${order.totalKg}kg</span></div>
    <div style="font-weight:800;border-top:1px dashed var(--cream-dark);margin-top:6px;padding-top:8px;"><span>Tổng tiền</span><span>${money(order.total)}</span></div>
    <div><span>Người nhận</span><span>${order.customerName}</span></div>
    <div><span>SĐT</span><span>${order.customerPhone}</span></div>
    <div><span>Địa chỉ</span><span>${order.address}, ${order.province}</span></div>
  `;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

renderCart();
