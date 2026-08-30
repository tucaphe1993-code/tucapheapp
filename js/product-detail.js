const params = new URLSearchParams(location.search);
const productId = params.get("id");
const product = getProductById(productId);
let selectedQty = 1;

function renderDetail() {
  const main = document.getElementById("detailMain");
  if (!product || !product.visible) {
    main.innerHTML = `<div class="empty-msg">Không tìm thấy sản phẩm này. <a href="products.html">Xem tất cả cà phê →</a></div>`;
    return;
  }
  document.title = product.name + " - Tú Cà Phê";
  document.getElementById("breadcrumb").textContent = product.name;

  main.innerHTML = `
    <div class="detail-grid">
      <div class="detail-image">${product.icon}</div>
      <div class="detail-info">
        <h1>${product.name}</h1>
        <p class="detail-desc">${product.description}</p>
        <div class="detail-specs">
          <span class="spec-chip">🎨 Hương vị: ${product.flavor}</span>
          <span class="spec-chip">🔥 Mức rang: ${product.roast}</span>
          <span class="spec-chip">🌱 Loại hạt: ${product.origin_type}</span>
          <span class="spec-chip">📦 Quy cách: theo ${product.unit}</span>
        </div>

        <div class="price-box" id="priceBox"></div>

        <div class="qty-selector">
          <button class="qty-btn" id="qtyDec">−</button>
          <span class="qty-value" id="qtyValue">1</span>
          <span class="qty-unit">${product.unit}</span>
          <button class="qty-btn" id="qtyInc">+</button>
        </div>

        <button class="btn primary lg full" id="addToCartBtn">Thêm vào giỏ hàng</button>
      </div>
    </div>
  `;

  document.getElementById("qtyDec").addEventListener("click", () => { selectedQty = Math.max(1, selectedQty - 1); updatePrice(); });
  document.getElementById("qtyInc").addEventListener("click", () => { selectedQty += 1; updatePrice(); });
  document.getElementById("addToCartBtn").addEventListener("click", () => {
    addToCart(product.id, selectedQty);
    const btn = document.getElementById("addToCartBtn");
    btn.textContent = "Đã thêm vào giỏ ✓";
    setTimeout(() => { btn.textContent = "Thêm vào giỏ hàng"; }, 900);
    updatePrice();
  });

  updatePrice();
}

function updatePrice() {
  document.getElementById("qtyValue").textContent = selectedQty;
  const cart = loadCart();
  const otherKg = getCartTotalKg(cart) - (cart[product.id] || 0);
  const previewTotalKg = otherKg + selectedQty;
  const unitPrice = getUnitPrice(product, previewTotalKg);
  const eligible = previewTotalKg >= product.wholesale_min_kg;

  document.getElementById("priceBox").innerHTML = `
    <div class="price-line"><span class="label">Giá lẻ</span><span class="value">${money(product.retail_price)}/${product.unit}</span></div>
    <div class="price-line"><span class="label">Giá sỉ từ ${product.wholesale_min_kg}kg</span><span class="value">${money(product.wholesale_price)}/${product.unit}</span></div>
    <div class="current-price">${money(unitPrice)}/${product.unit} <span style="font-size:0.9rem;color:var(--muted);font-weight:600;">— tạm tính cho ${selectedQty}${product.unit}</span></div>
    ${eligible
      ? `<div class="price-hint eligible">✓ Bạn đã được áp dụng giá sỉ.</div>`
      : `<div class="price-hint progress">Mua thêm ${product.wholesale_min_kg - previewTotalKg}kg (tính cả giỏ hàng) để nhận giá sỉ.</div>`}
  `;
}

renderDetail();
