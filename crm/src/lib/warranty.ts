// Ngày hết hạn bảo hành dự kiến = ngày mua + số tháng bảo hành. Dùng chung
// giữa phiếu in bảo hành và trang tra cứu QR công khai để tránh lệch logic.
export function addWarrantyMonths(iso: string, months: number): Date {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  d.setMonth(d.getMonth() + months);
  return d;
}
