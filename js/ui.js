// ===== UI SHELL DÙNG CHUNG: sidebar drawer (mobile), active nav, cart badge =====
document.addEventListener("DOMContentLoaded", () => {
  updateCartBadge();

  const currentPage = document.body.dataset.page;
  document.querySelectorAll(".sidebar-link[data-page]").forEach(link => {
    link.classList.toggle("active", link.dataset.page === currentPage);
  });

  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const menuToggle = document.getElementById("menuToggle");
  if (sidebar && overlay && menuToggle) {
    const open = () => { sidebar.classList.add("open"); overlay.classList.add("show"); };
    const close = () => { sidebar.classList.remove("open"); overlay.classList.remove("show"); };
    menuToggle.addEventListener("click", open);
    overlay.addEventListener("click", close);
    sidebar.querySelectorAll("a.sidebar-link").forEach(a => a.addEventListener("click", close));
  }
});
