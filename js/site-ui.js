// ===== SITE HEADER (trang khách hàng premium): scroll shadow, hamburger, search, active nav =====
document.addEventListener("DOMContentLoaded", () => {
  updateCartBadge();

  const currentPage = document.body.dataset.page;
  document.querySelectorAll(".site-nav a[data-page]").forEach(link => {
    link.classList.toggle("active", link.dataset.page === currentPage);
  });

  const header = document.getElementById("siteHeader");
  if (header) {
    window.addEventListener("scroll", () => {
      header.classList.toggle("scrolled", window.scrollY > 8);
    }, { passive: true });
  }

  const nav = document.getElementById("siteNav");
  const hamburger = document.getElementById("siteHamburger");
  const navOverlay = document.getElementById("siteNavOverlay");
  if (nav && hamburger && navOverlay) {
    const openNav = () => { nav.classList.add("mobile-open"); navOverlay.classList.add("show"); };
    const closeNav = () => { nav.classList.remove("mobile-open"); navOverlay.classList.remove("show"); };
    hamburger.addEventListener("click", openNav);
    navOverlay.addEventListener("click", closeNav);
    nav.querySelectorAll("a").forEach(a => a.addEventListener("click", closeNav));
  }

  const searchToggle = document.getElementById("siteSearchToggle");
  const searchBar = document.getElementById("siteSearchBar");
  if (searchToggle && searchBar) {
    searchToggle.addEventListener("click", () => {
      searchBar.classList.toggle("open");
      if (searchBar.classList.contains("open")) document.getElementById("siteSearchInput").focus();
    });
  }
  const searchInput = document.getElementById("siteSearchInput");
  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && searchInput.value.trim()) {
        window.location.href = "products.html?q=" + encodeURIComponent(searchInput.value.trim());
      }
    });
  }
});
