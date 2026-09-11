export const DELIVERY_METHODS = [
  "Khách đến lấy",
  "Gửi Xe Bus",
  "Gửi Cafe Bà Bé",
  "Gửi Xe Hoa Mai & Toàn Thắng",
  "Book Ship",
] as const;

export const PAYMENT_METHODS = ["Tiền mặt", "Chuyển khoản", "Khác"] as const;

export const PRODUCT_TYPE_LABEL: Record<string, string> = {
  COFFEE: "Cà phê",
  BREWER: "Máy pha cà phê",
  GRINDER: "Máy xay",
  EQUIPMENT: "Thiết bị",
  ACCESSORY: "Linh kiện / Phụ kiện",
  SERVICE: "Dịch vụ",
};

export const PRODUCT_TYPES = Object.keys(PRODUCT_TYPE_LABEL) as (keyof typeof PRODUCT_TYPE_LABEL)[];

export const UNIT_OPTIONS = ["Kg", "Gram", "Túi", "Máy", "Cái", "Bộ", "Chiếc", "Lần", "Dịch vụ"] as const;

// Bên A trên biên bản lắp đặt/bàn giao. Chỉ có tên công ty là chắc chắn —
// các trường còn lại là placeholder, cần cập nhật thành thông tin thật.
export const COMPANY_INFO = {
  name: "CÔNG TY TNHH SX - TM - DV TÚ CÀ PHÊ",
  address: "(Cập nhật địa chỉ công ty)",
  phone: "(Cập nhật số điện thoại)",
  email: "(Cập nhật email)",
};
