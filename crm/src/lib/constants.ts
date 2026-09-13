export const DELIVERY_METHODS = [
  "Khách đến lấy",
  "Gửi Xe Bus",
  "Gửi Cafe Bà Bé",
  "Gửi Xe Hoa Mai & Toàn Thắng",
  "Book Ship",
] as const;

// Đơn thiết bị (máy pha/máy xay/thiết bị/phụ kiện) đi kèm lắp đặt, khác hẳn
// đơn cà phê nên dùng hình thức giao hàng riêng.
export const EQUIPMENT_DELIVERY_METHODS = ["Khách tự lắp", "Lắp đặt tận nơi"] as const;

export const PAYMENT_METHODS = ["Tiền mặt", "Chuyển khoản", "Khác"] as const;

export const PRODUCT_TYPE_LABEL: Record<string, string> = {
  COFFEE: "Cà phê",
  BREWER: "Máy pha",
  GRINDER: "Máy xay",
  ACCESSORY: "Linh kiện",
  EQUIPMENT: "Thiết bị pha chế",
  SERVICE: "Dịch vụ",
};

// Thứ tự hiển thị trong bộ lọc/dropdown chọn loại sản phẩm. SERVICE vẫn
// hợp lệ trong CSDL (không sửa schema) nhưng không hiển thị trong danh
// sách này theo yêu cầu.
export const PRODUCT_TYPES = ["COFFEE", "BREWER", "GRINDER", "ACCESSORY", "EQUIPMENT"] as const;

// Tạo đơn giờ tách 2 luồng riêng — đơn cà phê và đơn thiết bị (spec: mục
// Máy Pha / Máy Xay / Thiết bị / Phụ kiện) — nên nhóm sản phẩm không-cà-phê
// lại để dùng cho luồng "Tạo đơn thiết bị".
export const EQUIPMENT_PRODUCT_TYPES = ["BREWER", "GRINDER", "EQUIPMENT", "ACCESSORY"] as const;

export const UNIT_OPTIONS = ["Kg", "Gram", "Túi", "Máy", "Cái", "Bộ", "Chiếc", "Lần", "Dịch vụ"] as const;

// Bên A trên biên bản lắp đặt/bàn giao và phiếu bán hàng.
export const COMPANY_INFO = {
  name: "CÔNG TY TNHH SX - TM - DV TÚ CÀ PHÊ",
  brandName: "Tú Cà Phê",
  slogan: "Giữ Trọn Hương Vị Thật",
  address: "Long Hương, Bà Rịa",
  phone: "0786.51.52.53",
  email: "(Cập nhật email)",
};
