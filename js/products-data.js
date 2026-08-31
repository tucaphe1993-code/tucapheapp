// =====================================================================
// SẢN PHẨM — cà phê rang mộc + thiết bị pha chế (máy pha, máy xay, dụng
// cụ). TOÀN BỘ giá/thông số bên dưới là DỮ LIỆU MẪU (demo) để dựng giao
// diện premium mới, lấy đúng theo ví dụ đã cung cấp cho 4 sản phẩm cà
// phê — CHƯA phải giá bán chính thức, cần Tú Cà Phê xác nhận trước khi
// vận hành thật. KHÔNG tự thêm thương hiệu/sản phẩm ngoài dữ liệu mẫu.
// =====================================================================

const PRODUCTS_STORE_KEY = "tcp_products_v3";

const PRODUCTS_SEED = [
  // ---------- CÀ PHÊ ----------
  {
    id: "crema-blend",
    category_id: "ca-phe",
    name: "Crema Blend",
    icon: "🥣",
    image: "https://images.pexels.com/photos/27860686/pexels-photo-27860686.jpeg?w=600",
    short_desc: "Pha trộn cân bằng, lớp crema dày, hợp pha máy espresso.",
    description: "Công thức phối trộn theo tỷ lệ riêng của Tú Cà Phê, cho lớp crema dày và tách cà phê cân bằng giữa vị đậm và hương thơm.",
    unit: "kg",
    retail_price: 300000,
    wholesale_price: 260000,
    wholesale_min_kg: 5,
    stock: 200,
    variants: { weight: ["1kg", "5kg", "10kg", "20kg"], grind: ["Hạt", "Xay phin", "Xay espresso"] },
    badge: "Bán chạy",
    visible: true,
  },
  {
    id: "honey-reserve",
    category_id: "ca-phe",
    name: "Honey Reserve",
    icon: "🍯",
    image: "https://images.pexels.com/photos/16682442/pexels-photo-16682442.jpeg?w=600",
    short_desc: "Chế biến honey process, vị ngọt đậm, hương trái cây chín.",
    description: "Cà phê chế biến theo phương pháp honey process, giữ lại một phần chất nhầy quả cà phê trong quá trình phơi, cho vị ngọt đậm và hương trái cây chín đặc trưng.",
    unit: "kg",
    retail_price: 350000,
    wholesale_price: 275000,
    wholesale_min_kg: 5,
    stock: 200,
    variants: { weight: ["1kg", "5kg", "10kg", "20kg"], grind: ["Hạt", "Xay phin", "Xay espresso"] },
    badge: null,
    visible: true,
  },
  {
    id: "phin-moc-ban",
    category_id: "ca-phe",
    name: "Phin Mộc Bản",
    icon: "☕",
    image: "https://images.pexels.com/photos/3936163/pexels-photo-3936163.jpeg?w=600",
    short_desc: "Rang mộc nguyên chất, đậm đà, chuyên dùng pha phin.",
    description: "Cà phê rang mộc nguyên chất, không tẩm phụ gia, rang theo mẻ nhỏ để giữ trọn hương vị đậm đà — chuyên dùng pha phin truyền thống.",
    unit: "kg",
    retail_price: 300000,
    wholesale_price: 260000,
    wholesale_min_kg: 5,
    stock: 200,
    variants: { weight: ["1kg", "5kg", "10kg", "20kg"], grind: ["Hạt", "Xay phin", "Xay espresso"] },
    badge: null,
    visible: true,
  },
  {
    id: "arabica-cau-dat",
    category_id: "ca-phe",
    name: "Arabica Cầu Đất",
    icon: "🌸",
    image: "https://images.pexels.com/photos/2036874/pexels-photo-2036874.jpeg?w=600",
    short_desc: "Arabica vùng cao Cầu Đất, chua thanh, hương hoa trái.",
    description: "Hạt Arabica trồng ở vùng cao Cầu Đất (Đà Lạt), rang vừa để giữ vị chua thanh đặc trưng cùng hương hoa và trái cây.",
    unit: "kg",
    retail_price: 450000,
    wholesale_price: 400000,
    wholesale_min_kg: 5,
    stock: 150,
    variants: { weight: ["1kg", "5kg", "10kg", "20kg"], grind: ["Hạt", "Xay phin", "Xay espresso"] },
    badge: "Cao cấp",
    visible: true,
  },

  // ---------- MÁY PHA ----------
  {
    id: "may-pha-compact-15",
    category_id: "may-pha",
    name: "Máy pha Espresso Compact 15",
    icon: "⚙️",
    short_desc: "Máy pha 1 group nhỏ gọn, phù hợp xe cà phê và quán take-away.",
    description: "Máy pha espresso 1 group, kích thước nhỏ gọn, khởi động nhanh — phù hợp mô hình xe cà phê, take-away, quán nhỏ.",
    unit: "cái",
    retail_price: 18000000,
    wholesale_price: 18000000,
    wholesale_min_kg: 1,
    stock: 20,
    specs: { "Số group": "1", "Áp suất bơm": "15 bar", "Công suất": "1400W", "Dung tích bình nước": "3L" },
    badge: "Bán chạy",
    visible: true,
  },
  {
    id: "may-pha-duo-2group",
    category_id: "may-pha",
    name: "Máy pha Espresso Duo 2 Group",
    icon: "⚙️",
    short_desc: "Máy pha 2 group công suất lớn, cho quán vừa và quán chuyên nghiệp.",
    description: "Máy pha espresso 2 group, cấp nhiệt ổn định, đáp ứng sản lượng lớn cho quán vừa và quán chuyên nghiệp.",
    unit: "cái",
    retail_price: 42000000,
    wholesale_price: 42000000,
    wholesale_min_kg: 1,
    stock: 10,
    specs: { "Số group": "2", "Áp suất bơm": "15 bar", "Công suất": "3200W", "Dung tích nồi hơi": "11L" },
    badge: null,
    visible: true,
  },

  // ---------- MÁY XAY ----------
  {
    id: "may-xay-chuyen-dung",
    category_id: "may-xay",
    name: "Máy xay cà phê chuyên dụng",
    icon: "🌀",
    short_desc: "Xay đều hạt, chỉnh độ mịn linh hoạt cho phin và espresso.",
    description: "Máy xay lưỡi đĩa, chỉnh độ mịn linh hoạt, phù hợp xay cho pha phin lẫn pha máy espresso.",
    unit: "cái",
    retail_price: 9500000,
    wholesale_price: 9500000,
    wholesale_min_kg: 1,
    stock: 15,
    specs: { "Loại lưỡi": "Đĩa (flat burr)", "Công suất": "250W", "Tốc độ xay": "1.5g/s" },
    badge: null,
    visible: true,
  },

  // ---------- THIẾT BỊ ----------
  {
    id: "bo-dung-cu-pha-che-co-ban",
    category_id: "thiet-bi",
    name: "Bộ dụng cụ pha chế cơ bản",
    icon: "🧰",
    short_desc: "Ca đánh sữa, cân điện tử, tamper, phin lọc — đủ bộ khởi đầu.",
    description: "Bộ dụng cụ pha chế cơ bản gồm ca đánh sữa, cân điện tử, tamper, phin lọc — đủ trang bị khởi đầu cho một quầy pha chế.",
    unit: "bộ",
    retail_price: 2800000,
    wholesale_price: 2800000,
    wholesale_min_kg: 1,
    stock: 30,
    specs: { "Số món": "8 món", "Chất liệu chính": "Inox 304" },
    badge: null,
    visible: true,
  },
];

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
function getProductsByCategory(categoryId) {
  return getVisibleProducts().filter(p => p.category_id === categoryId);
}
function getProductById(id) {
  return loadProducts().find(p => p.id === id) || null;
}

const money = (n) => Math.round(n).toLocaleString("vi-VN") + "₫";
const isInStock = (product) => typeof product.stock === "number" && product.stock > 0;

// Ảnh thật (URL) nếu có, ngược lại rơi về icon emoji đặt sẵn (placeholder).
function productMediaHtml(p) {
  return p.image ? `<img src="${p.image}" alt="${p.name.replace(/"/g, "")}">` : p.icon;
}
