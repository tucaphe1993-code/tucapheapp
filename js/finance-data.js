// =====================================================================
// TÀI CHÍNH — sổ thu/chi thủ công. Danh mục chỉ là gợi ý (datalist), không
// ép cứng, để admin tự đặt thêm danh mục khi cần.
// =====================================================================

const FINANCE_STORE_KEY = "tcp_finance_v1";
const FINANCE_SEQ_KEY = "tcp_finance_seq_v1";

const FINANCE_CATEGORY_SUGGESTIONS = {
  thu: ["Bán hàng", "Khác"],
  chi: ["Nhập nguyên liệu", "Lương nhân viên", "Thuê mặt bằng", "Điện nước", "Khác"],
};

function loadFinance() {
  return JSON.parse(localStorage.getItem(FINANCE_STORE_KEY) || "[]");
}
function saveFinance(list) {
  localStorage.setItem(FINANCE_STORE_KEY, JSON.stringify(list));
}
function nextFinanceId() {
  const seq = parseInt(localStorage.getItem(FINANCE_SEQ_KEY) || "0", 10) + 1;
  localStorage.setItem(FINANCE_SEQ_KEY, String(seq));
  return "TC-" + String(seq).padStart(6, "0");
}

// Trả về { totalThu, totalChi, profit } cho các giao dịch trong khoảng ngày.
function summarizeFinance(periodStart, periodEnd) {
  const start = new Date(periodStart).getTime();
  const end = new Date(periodEnd).getTime() + 24 * 60 * 60 * 1000 - 1;
  const list = loadFinance().filter(t => {
    const ts = new Date(t.date).getTime();
    return ts >= start && ts <= end;
  });
  const totalThu = list.filter(t => t.type === "thu").reduce((s, t) => s + t.amount, 0);
  const totalChi = list.filter(t => t.type === "chi").reduce((s, t) => s + t.amount, 0);
  return { totalThu, totalChi, profit: totalThu - totalChi, transactions: list };
}
