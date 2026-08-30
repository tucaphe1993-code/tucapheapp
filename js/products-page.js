function renderProductGrid() {
  const products = getVisibleProducts();
  const cart = loadCart();
  const totalKg = getCartTotalKg(cart);
  document.getElementById("productGrid").innerHTML = products.map(p => {
    const eligible = totalKg >= p.wholesale_min_kg;
    return `
    <div class="product-card" style="cursor:default;">
      <a href="product.html?id=${p.id}" style="text-decoration:none;color:inherit;">
        <div class="product-thumb">${p.icon}</div>
      </a>
      <div class="product-info">
        <a href="product.html?id=${p.id}" style="text-decoration:none;color:inherit;">
          <div class="product-name">${p.name}</div>
        </a>
        <div class="product-desc">${p.short_desc}</div>
        <div class="product-spec">${p.roast} · ${p.origin_type}</div>
        <div class="product-price-row">
          <div class="price-line retail"><span class="label">Giá lẻ</span><span class="value">${money(p.retail_price)}/${p.unit}</span></div>
          <div class="price-line wholesale"><span class="label">Giá sỉ từ ${p.wholesale_min_kg}kg</span><span class="value">${money(p.wholesale_price)}/${p.unit}</span></div>
        </div>
        <div class="product-actions">
          <a href="product.html?id=${p.id}" class="btn secondary sm full">Xem chi tiết</a>
          <button class="btn primary sm full" data-quickadd="${p.id}">Thêm vào giỏ</button>
        </div>
      </div>
    </div>`;
  }).join("");

  document.querySelectorAll("[data-quickadd]").forEach(btn => {
    btn.addEventListener("click", () => {
      addToCart(btn.dataset.quickadd, 1);
      btn.textContent = "Đã thêm ✓";
      setTimeout(() => { btn.textContent = "Thêm vào giỏ"; renderProductGrid(); }, 600);
    });
  });
}
renderProductGrid();
