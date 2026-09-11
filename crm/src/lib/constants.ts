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

export const UNIT_OPTIONS = ["Kg", "Gram", "Túi", "Máy", "Cái", "Bộ", "Chiếc", "Lần", "Dịch vụ"] as const;

// Bên A trên biên bản lắp đặt/bàn giao. Chỉ có tên công ty là chắc chắn —
// các trường còn lại là placeholder, cần cập nhật thành thông tin thật.
export const COMPANY_INFO = {
  name: "CÔNG TY TNHH SX - TM - DV TÚ CÀ PHÊ",
  address: "(Cập nhật địa chỉ công ty)",
  phone: "(Cập nhật số điện thoại)",
  email: "(Cập nhật email)",
};
