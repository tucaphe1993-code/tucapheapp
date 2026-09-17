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

// Công đoạn cà phê — chỉ áp dụng khi product_type = COFFEE. "PACKAGED" là
// giá trị hiển thị/gửi lên form cho coffee_stage = NULL (đóng gói, hành vi
// mặc định/hiện tại) — GREEN/ROASTED tồn theo KG lẻ.
export const COFFEE_STAGE_LABEL: Record<string, string> = {
  PACKAGED: "Đóng gói (theo túi/quy cách)",
  GREEN: "Nhân xanh (nguyên liệu thô)",
  ROASTED: "Rang rời (chưa đóng gói)",
};
export const COFFEE_STAGES = ["PACKAGED", "GREEN", "ROASTED"] as const;

/** SKU tồn theo KG lẻ (nhập/điều chỉnh được phép số thập phân, vd 3.5kg) — chỉ nhân xanh và cà phê rang rời. */
export function isBulkWeightProduct(productType: string, coffeeStage: string | null): boolean {
  return productType === "COFFEE" && (coffeeStage === "GREEN" || coffeeStage === "ROASTED");
}

// Tạo đơn giờ tách 2 luồng riêng — đơn cà phê và đơn thiết bị (spec: mục
// Máy Pha / Máy Xay / Thiết bị / Phụ kiện) — nên nhóm sản phẩm không-cà-phê
// lại để dùng cho luồng "Tạo đơn thiết bị".
export const EQUIPMENT_PRODUCT_TYPES = ["BREWER", "GRINDER", "EQUIPMENT", "ACCESSORY"] as const;

export const UNIT_OPTIONS = ["Kg", "Gram", "Túi", "Máy", "Cái", "Bộ", "Chiếc", "Lần", "Dịch vụ"] as const;

// Nhóm hàng (§ Danh mục Hàng hóa) — danh sách cố định để lọc/thống kê
// nhất quán, không để nhập tay tự do gây trùng lặp kiểu chữ.
export const PRODUCT_CATEGORY_OPTIONS = [
  "Máy Pha Cà Phê",
  "Máy Xay Cà Phê",
  "Cà Phê",
  "Máy Pha Chế",
  "Linh Kiện",
] as const;

// Bên A trên biên bản lắp đặt/bàn giao và phiếu bán hàng.
export const COMPANY_INFO = {
  name: "CÔNG TY TNHH SX - TM - DV TÚ CÀ PHÊ",
  brandName: "Tú Cà Phê",
  slogan: "Giữ Trọn Hương Vị Thật",
  tagline: "CUNG CẤP CÀ PHÊ & THIẾT BỊ PHA CHẾ",
  address: "Long Hương, Bà Rịa",
  phone: "0786.51.52.53",
  email: "(Cập nhật email)",
};
