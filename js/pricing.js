// =====================================================================
// LOGIC GIÁ LẺ / GIÁ SỈ — hàm thuần, không phụ thuộc DOM, dễ test độc lập.
//
// Quy tắc (đã xác nhận với chủ shop): ngưỡng áp giá sỉ tính theo TỔNG SỐ KG
// của TOÀN BỘ giỏ hàng (cộng dồn mọi sản phẩm), KHÔNG phải theo từng sản
// phẩm riêng lẻ. Với mỗi sản phẩm, nếu tổng kg cả giỏ >= wholesale_min_kg
// của sản phẩm đó thì sản phẩm đó được tính theo wholesale_price.
// =====================================================================

function getCartTotalKg(cart) {
  return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
}

// Trả về đơn giá áp dụng cho 1 sản phẩm, dựa trên tổng kg cả giỏ hiện tại.
function getUnitPrice(product, cartTotalKg) {
  return cartTotalKg >= product.wholesale_min_kg ? product.wholesale_price : product.retail_price;
}

function isWholesaleApplied(product, cartTotalKg) {
  return cartTotalKg >= product.wholesale_min_kg;
}

// Xây danh sách dòng giỏ hàng đầy đủ (giá, thành tiền) từ cart {productId: qty}.
function buildCartLines(cart) {
  const products = loadProducts();
  const totalKg = getCartTotalKg(cart);
  return Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
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
