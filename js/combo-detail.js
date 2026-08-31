const comboParams = new URLSearchParams(location.search);
const comboId = comboParams.get("id");
const combo = getComboById(comboId);

function renderComboDetail() {
  const main = document.getElementById("comboDetailMain");
  if (!combo || !combo.visible) {
    main.innerHTML = `<div class="empty-msg">Không tìm thấy combo này. <a href="combos.html">Xem tất cả combo →</a></div>`;
    return;
  }
  document.title = combo.name + " - Combo Tú Cà Phê";

  const products = loadProducts();
  const linkedItems = combo.items.map(it => ({ ...it, product: it.product_id ? products.find(p => p.id === it.product_id) : null }));
  const allLinked = linkedItems.every(it => it.product);
  const linkedValue = linkedItems.reduce((s, it) => s + (it.product ? it.product.retail_price : 0), 0);

  let valueBoxHtml = "";
  if (allLinked && combo.price_from) {
    const savings = Math.max(0, linkedValue - combo.price_from);
    valueBoxHtml = `
      <div class="price-line"><span class="label">Giá trị nếu mua lẻ</span><span class="value">${money(linkedValue)}</span></div>
      <div class="price-line"><span class="label">Tiết kiệm</span><span class="value" style="color:var(--success);">${money(savings)}</span></div>
    `;
  } else if (allLinked) {
    valueBoxHtml = `<div class="price-line"><span class="label">Giá trị nếu mua lẻ</span><span class="value">${money(linkedValue)}</span></div>`;
  } else {
    valueBoxHtml = `<div style="color:var(--muted);font-size:0.82rem;">Combo gồm cả hạng mục chưa có giá niêm yết riêng (xe, setup, hướng dẫn vận hành) nên chưa thể hiện giá trị mua lẻ đầy đủ.</div>`;
  }

  main.innerHTML = `
    <div class="detail-grid">
      <div class="detail-image" style="font-size:6rem;">${combo.icon}</div>
      <div class="detail-info">
        <a href="combos.html" style="color:var(--accent-dark);font-weight:700;font-size:0.82rem;text-decoration:none;">← Tất cả combo</a>
        <h1>${combo.name.toUpperCase()}</h1>
        <p class="detail-desc">${combo.tagline}</p>

        <div class="price-box">
          <div class="current-price">${combo.price_from ? "Từ " + money(combo.price_from) : "Liên hệ báo giá"}</div>
          ${valueBoxHtml}
        </div>

        ${combo.price_from
          ? `<button type="button" class="btn primary lg full" id="addComboToCartBtn">ĐẶT COMBO</button>`
          : `<div style="color:var(--muted);font-size:0.85rem;margin-bottom:6px;">Combo chưa có giá niêm yết — vui lòng liên hệ để được báo giá.</div>`
        }
        <a href="contact.html" class="btn outline lg full" style="margin-top:10px;">TƯ VẤN NGAY</a>
      </div>
    </div>

    <h2 class="section-title" style="margin-top:56px;">Sản phẩm trong combo</h2>
    <div class="combo-items-list">
      ${linkedItems.map(it => it.product
        ? `<a class="combo-item-row" href="product.html?id=${it.product.id}">
             <span class="combo-item-icon">${it.product.icon}</span>
             <span>${it.label}</span>
             <span class="combo-item-arrow">Xem chi tiết →</span>
           </a>`
        : `<div class="combo-item-row static">
             <span class="combo-item-icon">•</span>
             <span>${it.label}</span>
           </div>`
      ).join("")}
    </div>
  `;

  const addBtn = document.getElementById("addComboToCartBtn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      addToCart(comboCartKey(combo.id), 1);
      addBtn.textContent = "Đã thêm vào giỏ ✓";
      setTimeout(() => { window.location.href = "checkout.html"; }, 500);
    });
  }
}

renderComboDetail();
