// ===== TRANG DANH SÁCH COMBO =====
document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("comboGrid");
  grid.innerHTML = loadCombos().filter(c => c.visible).map((c, idx) => `
    <div class="combo-card" id="${c.id}">
      <div class="combo-card-num">COMBO ${String(idx + 1).padStart(2, "0")}</div>
      <h3>${c.name.toUpperCase()}</h3>
      <p style="color:#e6dac6;font-size:0.88rem;margin:-8px 0 0;">${c.tagline}</p>
      <ul>${c.items.map(it => `<li>${it.label}</li>`).join("")}</ul>
      <div class="combo-card-price">${c.price_from ? "Từ " + money(c.price_from) : "Liên hệ báo giá"}</div>
      <a href="combo.html?id=${c.id}" class="btn primary full">XEM COMBO</a>
    </div>
  `).join("");

  const hash = location.hash.replace("#", "");
  if (hash) {
    const target = document.getElementById(hash);
    if (target) setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  }
});
