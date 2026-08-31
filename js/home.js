// ===== TRANG CHỦ: best sellers, combo grid, smart combo finder wizard =====
document.addEventListener("DOMContentLoaded", () => {
  renderBestSellers();
  renderComboGrid();
  initFinderWizard();
});

function renderBestSellers() {
  const grid = document.getElementById("bestSellersGrid");
  if (!grid) return;
  const items = getProductsByCategory("ca-phe").slice(0, 4);
  grid.innerHTML = items.map(p => `
    <a class="product-card-v2" href="product.html?id=${p.id}">
      <div class="product-card-v2-art">
        ${productMediaHtml(p)}
        ${p.badge ? `<span class="product-card-v2-badge">${p.badge}</span>` : ""}
      </div>
      <div class="product-card-v2-name">${p.name.toUpperCase()}</div>
      <div class="product-card-v2-price">${money(p.retail_price)}/${p.unit}</div>
      <div class="product-card-v2-wholesale">Giá sỉ từ ${p.wholesale_min_kg}${p.unit}: ${money(p.wholesale_price)}/${p.unit}</div>
    </a>
  `).join("");
}

function renderComboGrid() {
  const grid = document.getElementById("comboGrid");
  if (!grid) return;
  grid.innerHTML = loadCombos().filter(c => c.visible).map((c, idx) => `
    <div class="combo-card">
      <div class="combo-card-num">COMBO ${String(idx + 1).padStart(2, "0")}</div>
      <h3>${c.name.toUpperCase()}</h3>
      <ul>${c.items.map(it => `<li>${it.label}</li>`).join("")}</ul>
      <div class="combo-card-price">${c.price_from ? "Từ " + money(c.price_from) : "Liên hệ báo giá"}</div>
      <a href="combo.html?id=${c.id}" class="btn outline full">XEM COMBO</a>
    </div>
  `).join("");
}

// ----- SMART COMBO FINDER -----
function initFinderWizard() {
  const overlay = document.getElementById("finderOverlay");
  const wizard = document.getElementById("finderWizard");
  const openBtn = document.getElementById("openFinderBtn");
  const closeBtn = document.getElementById("finderCloseBtn");
  if (!overlay || !wizard || !openBtn) return;

  const answers = { budget: null, model: null, volume: null };

  function showStep(step) {
    ["finderStep1", "finderStep2", "finderStep3", "finderResult"].forEach((id, i) => {
      document.getElementById(id).style.display = (i + 1 === step || (step === 4 && id === "finderResult")) ? "block" : "none";
    });
  }
  function resetWizard() {
    answers.budget = null; answers.model = null; answers.volume = null;
    wizard.querySelectorAll(".finder-option.selected").forEach(b => b.classList.remove("selected"));
    showStep(1);
  }

  function computeResult() {
    // Không dùng AI — lấy mức cao nhất giữa ngân sách và sản lượng để suy ra combo phù hợp.
    const tier = Math.max(answers.budget, answers.model, answers.volume);
    let combo;
    if (tier <= 0) combo = getComboById("khoi-nghiep");
    else if (tier <= 2) combo = getComboById("xe-ca-phe");
    else combo = getComboById("tron-goi");
    return combo;
  }

  function showResult() {
    const combo = computeResult();
    document.getElementById("finderResultBody").innerHTML = `
      <h3>${combo.name.toUpperCase()}</h3>
      <p style="color:var(--muted);margin:6px 0 16px;">${combo.tagline}</p>
      <div style="font-weight:800;font-size:1.2rem;color:var(--accent-dark);margin-bottom:18px;">
        ${combo.price_from ? "Từ " + money(combo.price_from) : "Liên hệ báo giá"}
      </div>
      <a href="combo.html?id=${combo.id}" class="btn primary full">XEM COMBO NÀY →</a>
    `;
    showStep(4);
  }

  wizard.querySelectorAll('[data-finder-group="budget"] .finder-option').forEach(btn => {
    btn.addEventListener("click", () => {
      answers.budget = Number(btn.dataset.value);
      wizard.querySelectorAll('[data-finder-group="budget"] .finder-option').forEach(b => b.classList.toggle("selected", b === btn));
      showStep(2);
    });
  });
  wizard.querySelectorAll('[data-finder-group="model"] .finder-option').forEach(btn => {
    btn.addEventListener("click", () => {
      answers.model = Number(btn.dataset.value);
      wizard.querySelectorAll('[data-finder-group="model"] .finder-option').forEach(b => b.classList.toggle("selected", b === btn));
      showStep(3);
    });
  });
  wizard.querySelectorAll('[data-finder-group="volume"] .finder-option').forEach(btn => {
    btn.addEventListener("click", () => {
      answers.volume = Number(btn.dataset.value);
      wizard.querySelectorAll('[data-finder-group="volume"] .finder-option').forEach(b => b.classList.toggle("selected", b === btn));
      showResult();
    });
  });
  document.getElementById("finderBack2").addEventListener("click", () => showStep(1));
  document.getElementById("finderBack3").addEventListener("click", () => showStep(2));
  document.getElementById("finderRestartBtn").addEventListener("click", resetWizard);

  function open() {
    resetWizard();
    overlay.classList.add("show");
    wizard.classList.add("show");
  }
  function close() {
    overlay.classList.remove("show");
    wizard.classList.remove("show");
  }
  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", close);
}
