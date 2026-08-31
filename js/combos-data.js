// =====================================================================
// COMBO KINH DOANH CÀ PHÊ — dữ liệu mẫu (demo), theo đúng nội dung được
// cung cấp. Combo 01 chưa có giá cụ thể ("Từ XX triệu" trong bản mô tả
// gốc) nên KHÔNG tự bịa số — hiển thị "Liên hệ báo giá" cho tới khi có
// số liệu thật.
// =====================================================================

const COMBOS_STORE_KEY = "tcp_combos_v1";

const COMBOS_SEED = [
  {
    id: "khoi-nghiep",
    name: "Khởi nghiệp",
    tagline: "Bộ thiết bị cơ bản để bắt đầu pha chế chuyên nghiệp",
    icon: "🧰",
    price_from: null,
    items: [
      { label: "Máy pha", product_id: "may-pha-compact-15" },
      { label: "Máy xay", product_id: "may-xay-chuyen-dung" },
      { label: "Dụng cụ pha chế", product_id: "bo-dung-cu-pha-che-co-ban" },
    ],
    visible: true,
  },
  {
    id: "xe-ca-phe",
    name: "Xe cà phê",
    tagline: "Trọn bộ để vận hành một xe cà phê lưu động",
    icon: "🚐",
    price_from: 39000000,
    items: [
      { label: "Xe cà phê" },
      { label: "Máy pha", product_id: "may-pha-compact-15" },
      { label: "Máy xay", product_id: "may-xay-chuyen-dung" },
      { label: "Thiết bị", product_id: "bo-dung-cu-pha-che-co-ban" },
      { label: "Cà phê", product_id: "crema-blend" },
    ],
    visible: true,
  },
  {
    id: "tron-goi",
    name: "Trọn gói",
    tagline: "Giải pháp đầy đủ nhất — setup và hướng dẫn vận hành tận nơi",
    icon: "📦",
    price_from: 59000000,
    items: [
      { label: "Xe cà phê" },
      { label: "Thiết bị", product_id: "bo-dung-cu-pha-che-co-ban" },
      { label: "Cà phê", product_id: "crema-blend" },
      { label: "Setup" },
      { label: "Hướng dẫn vận hành" },
    ],
    visible: true,
  },
];

function loadCombos() {
  const saved = JSON.parse(localStorage.getItem(COMBOS_STORE_KEY) || "null");
  if (saved && Array.isArray(saved)) return saved;
  const seeded = COMBOS_SEED.map(c => ({ ...c }));
  localStorage.setItem(COMBOS_STORE_KEY, JSON.stringify(seeded));
  return seeded;
}
function saveCombos(list) {
  localStorage.setItem(COMBOS_STORE_KEY, JSON.stringify(list));
}
function getComboById(id) {
  return loadCombos().find(c => c.id === id) || null;
}

// Ảnh thật (URL) nếu có, ngược lại rơi về icon emoji đặt sẵn (placeholder).
function comboMediaHtml(c) {
  return c.image ? `<img src="${c.image}" alt="${c.name.replace(/"/g, "")}">` : c.icon;
}
