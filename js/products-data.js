// =====================================================================
// ⚠️ DỮ LIỆU SẢN PHẨM MẪU (DEMO) — CHƯA PHẢI GIÁ THẬT
// Toàn bộ retail_price / wholesale_price / wholesale_min_kg bên dưới là số
// liệu minh hoạ để dựng giao diện. TUYỆT ĐỐI không dùng để bán hàng thật.
// Khi có bảng giá chính thức từ Tú Cà Phê, thay thế mảng PRODUCTS này (hoặc
// nối vào API backend — xem loadProducts() bên dưới).
// =====================================================================

const PRODUCTS_STORE_KEY = "tcp_products_v1";

const PRODUCTS_SEED = [
  {
    id: "robusta-rang-moc",
    name: "Robusta Rang Mộc",
    icon: "☕",
    short_desc: "Đậm đà, hậu vị đắng mạnh, hợp gu pha phin truyền thống.",
    description: "Cà phê Robusta rang mộc nguyên chất, không tẩm phụ gia. Hạt được chọn lọc từ vùng nguyên liệu Tây Nguyên, rang theo mẻ nhỏ để giữ trọn hương vị đậm đà đặc trưng.",
    flavor: "Đắng đậm, hậu ngọt nhẹ",
    roast: "Rang đậm",
    origin_type: "Robusta nguyên chất",
    unit: "kg",
    retail_price: 180000,
    wholesale_price: 150000,
    wholesale_min_kg: 5,
    stock: 200,
    visible: true,
  },
  {
    id: "arabica-cau-dat",
    name: "Arabica Cầu Đất",
    icon: "🌸",
    short_desc: "Chua thanh, hương hoa quả, hợp pha máy espresso.",
    description: "Arabica trồng tại Cầu Đất, Đà Lạt — vùng khí hậu mát mẻ cho hạt cà phê có vị chua thanh đặc trưng, hương thơm hoa quả nhẹ nhàng.",
    flavor: "Chua thanh, hương hoa quả",
    roast: "Rang vừa",
    origin_type: "Arabica nguyên chất",
    unit: "kg",
    retail_price: 240000,
    wholesale_price: 200000,
    wholesale_min_kg: 5,
    stock: 200,
    visible: true,
  },
  {
    id: "culi-robusta",
    name: "Culi Robusta",
    icon: "🌰",
    short_desc: "Hạt tròn đặc biệt, đậm đà hiếm có, ít chua.",
    description: "Culi là hạt cà phê tròn đặc biệt (chỉ có 1 nhân trong quả thay vì 2), cho vị đậm đà và hàm lượng caffeine cao hơn hạt thường.",
    flavor: "Đậm, ít chua",
    roast: "Rang đậm",
    origin_type: "Culi Robusta",
    unit: "kg",
    retail_price: 220000,
    wholesale_price: 190000,
    wholesale_min_kg: 5,
    stock: 200,
    visible: true,
  },
  {
    id: "blend-dac-biet",
    name: "Blend Đặc Biệt",
    icon: "🥣",
    short_desc: "Pha trộn cân bằng giữa Arabica và Robusta.",
    description: "Công thức phối trộn giữa Arabica và Robusta theo tỷ lệ riêng của Tú Cà Phê, cho tách cà phê cân bằng giữa vị đậm và hương thơm.",
    flavor: "Cân bằng, hài hoà",
    roast: "Rang vừa - đậm",
    origin_type: "Blend Arabica + Robusta",
    unit: "kg",
    retail_price: 200000,
    wholesale_price: 170000,
    wholesale_min_kg: 5,
    stock: 200,
    visible: true,
  },
];

// ===== STORE (localStorage) — admin có thể sửa mà không cần backend =====
// TODO: khi có backend thật, thay 2 hàm dưới bằng fetch('/api/products') GET/PUT.
function loadProducts() {
  const saved = JSON.parse(localStorage.getItem(PRODUCTS_STORE_KEY) || "null");
  if (saved && Array.isArray(saved)) return saved;
  const seeded = PRODUCTS_SEED.map(p => ({ ...p }));
  localStorage.setItem(PRODUCTS_STORE_KEY, JSON.stringify(seeded));
  return seeded;
}
function saveProducts(list) {
  localStorage.setItem(PRODUCTS_STORE_KEY, JSON.stringify(list));
}
function getVisibleProducts() {
  return loadProducts().filter(p => p.visible);
}
function getProductById(id) {
  return loadProducts().find(p => p.id === id) || null;
}

const money = (n) => Math.round(n).toLocaleString("vi-VN") + "₫";
const isInStock = (product) => typeof product.stock === "number" && product.stock > 0;
