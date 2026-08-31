// ===== TRANG SẢN PHẨM: lọc theo danh mục (?cat=) hoặc tìm kiếm (?q=) =====
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  const cat = params.get("cat");
  const q = (params.get("q") || "").trim();

  renderCategoryPills(cat, q);

  let items = getVisibleProducts();
  let title = "Tất cả sản phẩm";
  let sub = "Cà phê, máy pha, máy xay và thiết bị pha chế từ Tú Cà Phê.";

  if (q) {
    items = items.filter(p => p.name.toLowerCase().includes(q.toLowerCase()));
    title = `Kết quả tìm kiếm cho "${q}"`;
    sub = `${items.length} sản phẩm phù hợp.`;
  } else if (cat) {
    const category = getCategoryById(cat);
    items = items.filter(p => p.category_id === cat);
    title = category ? category.name : "Sản phẩm";
    sub = category ? category.tagline : "";
  }

  document.getElementById("pageTitle").textContent = title;
  document.getElementById("pageSub").textContent = sub;
  document.getElementById("productGrid").innerHTML = items.length
    ? items.map(productCardHtml).join("")
    : `<p class="empty-msg">Không tìm thấy sản phẩm nào.</p>`;
});

function productCardHtml(p) {
  const isCoffee = p.category_id === "ca-phe";
  const priceLine = isCoffee
    ? `<div class="product-card-v2-price">${money(p.retail_price)}/${p.unit}</div>
       <div class="product-card-v2-wholesale">Giá sỉ từ ${p.wholesale_min_kg}${p.unit}: ${money(p.wholesale_price)}/${p.unit}</div>`
    : `<div class="product-card-v2-price">${money(p.retail_price)}/${p.unit}</div>`;
  return `
    <a class="product-card-v2" href="product.html?id=${p.id}">
      <div class="product-card-v2-art">
        ${p.icon}
        ${p.badge ? `<span class="product-card-v2-badge">${p.badge}</span>` : ""}
      </div>
      <div class="product-card-v2-name">${p.name.toUpperCase()}</div>
      ${priceLine}
    </a>
  `;
}

function renderCategoryPills(activeCat, q) {
  const all = [{ id: "", name: "Tất cả" }, ...loadCategories()];
  document.getElementById("categoryPills").innerHTML = all.map(c => {
    const isActive = !q && (activeCat || "") === c.id;
    const href = c.id ? `products.html?cat=${c.id}` : `products.html`;
    return `<a class="category-filter-pill ${isActive ? "active" : ""}" href="${href}">${c.name}</a>`;
  }).join("");
}
