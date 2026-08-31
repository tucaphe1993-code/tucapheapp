const params = new URLSearchParams(location.search);
const productId = params.get("id");
const product = getProductById(productId);
const isCoffee = product && product.category_id === "ca-phe";
let selectedQty = 1;
let selectedGrind = isCoffee ? product.variants.grind[0] : null;

function renderDetail() {
  const main = document.getElementById("detailMain");
  if (!product || !product.visible) {
    main.innerHTML = `<div class="empty-msg">Không tìm thấy sản phẩm này. <a href="products.html">Xem tất cả sản phẩm →</a></div>`;
    return;
  }
  document.title = product.name + " - Tú Cà Phê";

  const category = getCategoryById(product.category_id);

  main.innerHTML = `
    <div class="detail-grid">
      <div class="detail-image">${productMediaHtml(product)}</div>
      <div class="detail-info">
        <a href="products.html?cat=${product.category_id}" style="color:var(--accent-dark);font-weight:700;font-size:0.82rem;text-decoration:none;">← ${category ? category.name : "Sản phẩm"}</a>
        <h1>${product.name}</h1>
        <p class="detail-desc">${product.description}</p>

        ${isCoffee ? `
          <div class="variant-group">
            <div class="variant-label">Khối lượng</div>
            <div class="variant-pills" id="weightPills">
              ${product.variants.weight.map(w => `<button type="button" class="variant-pill" data-weight="${w}">${w}</button>`).join("")}
            </div>
          </div>
          <div class="variant-group">
            <div class="variant-label">Quy cách</div>
            <div class="variant-pills" id="grindPills">
              ${product.variants.grind.map(g => `<button type="button" class="variant-pill" data-grind="${g}">${g}</button>`).join("")}
            </div>
          </div>
        ` : `
          <div class="detail-specs">
            ${Object.entries(product.specs || {}).map(([k, v]) => `<span class="spec-chip">${k}: ${v}</span>`).join("")}
          </div>
        `}

        <div class="price-box" id="priceBox"></div>

        ${!isCoffee ? `
          <div class="qty-selector">
            <button type="button" class="qty-btn" id="qtyDec">−</button>
            <span class="qty-value" id="qtyValue">1</span>
            <span class="qty-unit">${product.unit}</span>
            <button type="button" class="qty-btn" id="qtyInc">+</button>
          </div>
        ` : ""}

        <button type="button" class="btn primary lg full" id="addToCartBtn">Thêm vào giỏ hàng</button>
        <a href="checkout.html" class="btn outline lg full" style="margin-top:10px;">Đặt hàng ngay</a>
      </div>
    </div>
  `;

  if (isCoffee) {
    const weightPills = document.querySelectorAll("#weightPills .variant-pill");
    weightPills.forEach(btn => {
      btn.classList.toggle("selected", btn.dataset.weight === "1kg");
      btn.addEventListener("click", () => {
        selectedQty = parseInt(btn.dataset.weight, 10);
        weightPills.forEach(b => b.classList.toggle("selected", b === btn));
        updatePrice();
      });
    });
    const grindPills = document.querySelectorAll("#grindPills .variant-pill");
    grindPills.forEach(btn => {
      btn.classList.toggle("selected", btn.dataset.grind === selectedGrind);
      btn.addEventListener("click", () => {
        selectedGrind = btn.dataset.grind;
        grindPills.forEach(b => b.classList.toggle("selected", b === btn));
      });
    });
  } else {
    document.getElementById("qtyDec").addEventListener("click", () => { selectedQty = Math.max(1, selectedQty - 1); updatePrice(); });
    document.getElementById("qtyInc").addEventListener("click", () => { selectedQty += 1; updatePrice(); });
  }

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
  const qtyValueEl = document.getElementById("qtyValue");
  if (qtyValueEl) qtyValueEl.textContent = selectedQty;

  const priceBox = document.getElementById("priceBox");

  if (!isCoffee) {
    priceBox.innerHTML = `
      <div class="current-price">${money(product.retail_price)}${selectedQty > 1 ? ` × ${selectedQty} = ${money(product.retail_price * selectedQty)}` : ""}</div>
    `;
    return;
  }

  const cart = loadCart();
  const otherKg = getCartTotalKg(cart) - (cart[product.id] || 0);
  const previewTotalKg = otherKg + selectedQty;
  const unitPrice = getUnitPrice(product, previewTotalKg);
  const eligible = previewTotalKg >= product.wholesale_min_kg;

  priceBox.innerHTML = `
    <div class="price-line"><span class="label">Giá lẻ</span><span class="value">${money(product.retail_price)}/${product.unit}</span></div>
    <div class="price-line"><span class="label">Giá sỉ từ ${product.wholesale_min_kg}kg</span><span class="value">${money(product.wholesale_price)}/${product.unit}</span></div>
    <div class="current-price">${money(unitPrice)}/${product.unit} <span style="font-size:0.9rem;color:var(--muted);font-weight:600;">— tạm tính cho ${selectedQty}${product.unit}</span></div>
    ${eligible
      ? `<div class="price-hint eligible">✓ Bạn đã được áp dụng giá sỉ.</div>`
      : `<div class="price-hint progress">Mua thêm ${product.wholesale_min_kg - previewTotalKg}kg (tính cả giỏ hàng) để nhận giá sỉ.</div>`}
  `;
}

renderDetail();
