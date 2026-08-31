// =====================================================================
// ⚠️ DỮ LIỆU SẢN PHẨM — Tú Cà Phê xác nhận website CHỈ bán đúng 4 sản phẩm
// dưới đây (Crema Blend, Honey Reserve, Phin Mộc Bản, Arabica Cầu Đất).
// KHÔNG tự thêm sản phẩm khác.
//
// GIÁ: retail_price/wholesale_price bên dưới VẪN LÀ DEMO (minh hoạ giao diện),
// TRỪ "Honey Reserve" có wholesale_price = 275.000đ/kg là số liệu THẬT do Tú Cà
// Phê cung cấp trước đó — các giá còn lại CHƯA phải giá chính thức, cần Tú Cà
// Phê xác nhận trước khi vận hành thật.
// =====================================================================

const PRODUCTS_STORE_KEY = "tcp_products_v2";

const PRODUCTS_SEED = [
  {
    id: "crema-blend",
    name: "Crema Blend",
    icon: "🥣",
    short_desc: "Pha trộn cân bằng, lớp crema dày, hợp pha máy espresso.",
    description: "Công thức phối trộn theo tỷ lệ riêng của Tú Cà Phê, cho lớp crema dày và tách cà phê cân bằng giữa vị đậm và hương thơm.",
    flavor: "Cân bằng, hài hoà",
    roast: "Rang vừa - đậm",
    origin_type: "Blend đặc chế",
    unit: "kg",
    // ⚠️ Giá demo, chưa xác nhận
    retail_price: 200000,
    wholesale_price: 170000,
    wholesale_min_kg: 5,
    stock: 200,
    visible: true,
  },
  {
    id: "honey-reserve",
    name: "Honey Reserve",
    icon: "🍯",
    short_desc: "Chế biến honey process, vị ngọt đậm, hương trái cây chín.",
    description: "Cà phê chế biến theo phương pháp honey process, giữ lại một phần chất nhầy quả cà phê trong quá trình phơi, cho vị ngọt đậm và hương trái cây chín đặc trưng.",
    flavor: "Ngọt đậm, hương trái cây chín",
    roast: "Rang vừa",
    origin_type: "Honey Process",
    unit: "kg",
    // ⚠️ retail_price là giá demo (CHƯA xác nhận). wholesale_price = 275.000đ/kg
    // là số liệu THẬT do Tú Cà Phê cung cấp trước đó.
    retail_price: 320000,
    wholesale_price: 275000,
    wholesale_min_kg: 5,
    stock: 200,
    visible: true,
  },
  {
    id: "phin-moc-ban",
    name: "Phin Mộc Bản",
    icon: "☕",
    short_desc: "Rang mộc nguyên chất, đậm đà, chuyên dùng pha phin.",
    description: "Cà phê rang mộc nguyên chất, không tẩm phụ gia, rang theo mẻ nhỏ để giữ trọn hương vị đậm đà — chuyên dùng pha phin truyền thống.",
    flavor: "Đắng đậm, hậu ngọt nhẹ",
    roast: "Rang đậm",
    origin_type: "Rang mộc nguyên chất",
    unit: "kg",
    // ⚠️ Giá demo, chưa xác nhận
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
    // ⚠️ Giá demo, chưa xác nhận
    retail_price: 240000,
    wholesale_price: 200000,
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
