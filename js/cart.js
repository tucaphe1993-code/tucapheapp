// ===== GIỎ HÀNG (localStorage) — dùng chung mọi trang =====
const CART_KEY = "tcp_cart_v1";

function loadCart() {
  return JSON.parse(localStorage.getItem(CART_KEY) || "{}");
}
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}
function addToCart(productId, qty) {
  const cart = loadCart();
  cart[productId] = (cart[productId] || 0) + qty;
  saveCart(cart);
  updateCartBadge();
  return cart;
}
function setCartQty(productId, qty) {
  const cart = loadCart();
  if (qty <= 0) delete cart[productId];
  else cart[productId] = qty;
  saveCart(cart);
  updateCartBadge();
  return cart;
}
function removeFromCart(productId) {
  const cart = loadCart();
  delete cart[productId];
  saveCart(cart);
  updateCartBadge();
  return cart;
}
function clearCart() {
  saveCart({});
  updateCartBadge();
}
function updateCartBadge() {
  const el = document.getElementById("cartCount");
  if (!el) return;
  const cart = loadCart();
  el.textContent = Object.values(cart).reduce((s, q) => s + q, 0);
}
