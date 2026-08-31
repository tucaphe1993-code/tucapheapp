// =====================================================================
// LOGIC GIÁ LẺ / GIÁ SỈ — hàm thuần, không phụ thuộc DOM, dễ test độc lập.
//
// Quy tắc (đã xác nhận với chủ shop): ngưỡng áp giá sỉ tính theo TỔNG SỐ KG
// của TOÀN BỘ giỏ hàng (cộng dồn mọi sản phẩm), KHÔNG phải theo từng sản
// phẩm riêng lẻ. Với mỗi sản phẩm, nếu tổng kg cả giỏ >= wholesale_min_kg
// của sản phẩm đó thì sản phẩm đó được tính theo wholesale_price.
// =====================================================================

// Tiền tố dùng để lưu combo trong cùng giỏ hàng {id: qty} với sản phẩm thường.
const COMBO_CART_PREFIX = "combo:";
function comboCartKey(comboId) { return COMBO_CART_PREFIX + comboId; }
function isComboCartKey(key) { return key.startsWith(COMBO_CART_PREFIX); }

// Combo không tính vào tổng kg (không phải cà phê bán theo kg) — chỉ đếm sản phẩm thường.
function getCartTotalKg(cart) {
  return Object.entries(cart).reduce((sum, [id, qty]) => sum + (isComboCartKey(id) ? 0 : qty), 0);
}

// Giá sỉ theo tổng kg giỏ hàng CHỈ áp dụng cho cà phê (bán theo kg) — sản phẩm
// thiết bị (máy pha/máy xay/thiết bị) có 1 giá cố định, không có khái niệm sỉ.
function getUnitPrice(product, cartTotalKg) {
  if (product.category_id !== "ca-phe") return product.retail_price;
  return cartTotalKg >= product.wholesale_min_kg ? product.wholesale_price : product.retail_price;
}

function isWholesaleApplied(product, cartTotalKg) {
  if (product.category_id !== "ca-phe") return false;
  return cartTotalKg >= product.wholesale_min_kg;
}

// Xây danh sách dòng giỏ hàng đầy đủ (giá, thành tiền) từ cart {id: qty}.
// id có thể là id sản phẩm thường, hoặc "combo:<comboId>" cho 1 combo trọn gói.
function buildCartLines(cart) {
  const products = loadProducts();
  const totalKg = getCartTotalKg(cart);
  return Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      if (isComboCartKey(id)) {
        const combo = getComboById(id.slice(COMBO_CART_PREFIX.length));
        if (!combo || !combo.price_from) return null; // combo chưa có giá thì không cho vào giỏ
        return {
          id, qty, icon: combo.icon, name: "[Combo] " + combo.name, unit: "bộ",
          category_id: "combo", unitPrice: combo.price_from,
          isWholesale: false, lineTotal: combo.price_from * qty,
        };
      }
      const p = products.find(pr => pr.id === id);
      if (!p) return null;
      const unitPrice = getUnitPrice(p, totalKg);
      return {
        ...p, qty, unitPrice,
        isWholesale: isWholesaleApplied(p, totalKg),
        lineTotal: unitPrice * qty,
      };
    })
    .filter(Boolean);
}

function getCartTotal(cart) {
  return buildCartLines(cart).reduce((sum, l) => sum + l.lineTotal, 0);
}

// Thông báo tiến độ giá sỉ, dùng chung cho trang chi tiết sản phẩm / giỏ hàng.
// Vì mỗi sản phẩm có thể có wholesale_min_kg khác nhau, lấy ngưỡng THẤP NHẤT
// trong các sản phẩm đang có trong giỏ (hoặc sản phẩm đang xem) để đưa ra gợi ý gần nhất.
function getWholesaleHint(cart, focusProduct) {
  const totalKg = getCartTotalKg(cart);
  const products = focusProduct ? [focusProduct] : buildCartLines(cart);
  if (!products.length) return null;
  const minThreshold = Math.min(...products.map(p => p.wholesale_min_kg));
  if (totalKg >= minThreshold) {
    return { eligible: true, message: "✓ Bạn đã được áp dụng giá sỉ." };
  }
  const remaining = minThreshold - totalKg;
  return { eligible: false, message: `Mua thêm ${remaining}kg để nhận giá sỉ.`, remaining };
}
