// =====================================================================
// GIỎ HÀNG & ĐẶT HÀNG — đơn hàng được tạo thật trên server (Cloudflare
// Worker + D1, xem worker/README.md): server tự sinh mã đơn, tự tính lại
// giá/tồn kho (không tin số liệu trình duyệt gửi lên) và tự trừ kho. Trang
// này không còn giữ bản sao đơn hàng cục bộ — muốn xem danh sách đơn hàng,
// vào khu quản trị (đọc thẳng từ server).
// =====================================================================

// TODO: thay bằng URL Cloudflare Worker thật sau khi deploy (xem worker/README.md),
// vd: "https://tucaphe-order-api.<subdomain>.workers.dev/api/orders"
const ORDER_API_URL = `${API_BASE_URL}/orders`;

async function cartStatusHtml(cart) {
  const lines = await buildCartLines(cart);
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

async function renderCart() {
  const cart = loadCart();
  const lines = await buildCartLines(cart);
  document.getElementById("cartStatusBanner").innerHTML = await cartStatusHtml(cart);

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
  const totalMoney = await getCartTotal(cart);
  document.getElementById("cartSummary").style.display = lines.length ? "block" : "none";
  document.getElementById("cartTotalKg").textContent = totalKg + "kg";
  document.getElementById("cartTotalMoney").textContent = money(totalMoney);
  document.getElementById("checkoutForm").style.display = lines.length ? "flex" : "none";

  document.querySelectorAll("[data-inc]").forEach(b => b.addEventListener("click", async () => {
    const c = loadCart(); setCartQty(b.dataset.inc, (c[b.dataset.inc] || 0) + 1); await renderCart();
  }));
  document.querySelectorAll("[data-dec]").forEach(b => b.addEventListener("click", async () => {
    const c = loadCart(); setCartQty(b.dataset.dec, Math.max(0, (c[b.dataset.dec] || 0) - 1)); await renderCart();
  }));
  document.querySelectorAll("[data-remove]").forEach(b => b.addEventListener("click", async () => {
    removeFromCart(b.dataset.remove); await renderCart();
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
  const lines = await buildCartLines(cart);
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

  const orderRequest = {
    createdAt: new Date().toISOString(),
    customerName: name, customerPhone: phone, customerCompany: company,
    address, province, note,
    lines: lines.map(l => ({ productId: l.id, qty: l.qty })),
    delivery_status: "Chưa giao", delivery_date_planned: "", delivery_date_actual: "", shipper_name: "",
  };

  // Server (Cloudflare Worker) tự sinh mã đơn, tự tính lại giá/tồn kho và tự
  // trừ kho — không tin số liệu trình duyệt gửi lên. Không còn fallback lưu
  // cục bộ: nếu request lỗi, đơn THỰC SỰ chưa được tạo, phải báo cho khách.
  let order;
  try {
    const res = await fetch(ORDER_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderRequest),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Đặt hàng thất bại, vui lòng thử lại.");
    order = data;
    invalidateProductsCache(); // đơn hàng đã trừ kho trên server — cache cũ sẽ sai tồn kho
  } catch (err) {
    showFormError(err.message || "Không kết nối được tới máy chủ, vui lòng thử lại hoặc gọi 0786.51.52.53.");
    isSubmitting = false;
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    return;
  }

  upsertCustomerFromOrder(order);
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
