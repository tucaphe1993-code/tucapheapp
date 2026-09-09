// =====================================================================
// XUẤT NHẬP TỒN — sổ giao dịch kho cho cả Nguyên liệu VÀ Sản phẩm bán.
//
// Sản phẩm (đã đồng bộ thật qua Cloudflare Worker + D1 — xem
// worker/README.md): stock + lịch sử phiếu nằm trên máy chủ, đọc/ghi qua
// API trong js/products-data.js (adjustProductStockRemote/listStockTxRemote).
// Nguyên liệu (CHƯA đồng bộ, ngoài phạm vi đợt này): vẫn lưu localStorage
// riêng từng máy như trước.
//
// Vì vậy TOÀN BỘ hàm trong file này giờ là ASYNC — nơi gọi phải dùng `await`.
// Thao tác ghi lên sản phẩm cần `adminToken` (chỉ có trong khu quản trị).
// =====================================================================

const STOCK_TX_STORE_KEY = "tcp_stock_tx_v1"; // chỉ chứa phiếu của NGUYÊN LIỆU
const STOCK_TX_SEQ_KEY = "tcp_stock_tx_seq_v1";

function loadStockTx() {
  return JSON.parse(localStorage.getItem(STOCK_TX_STORE_KEY) || "[]");
}
function saveStockTx(list) {
  localStorage.setItem(STOCK_TX_STORE_KEY, JSON.stringify(list));
}
// Tiền tố "...I" (Ingredient) để không trùng mã với phiếu sản phẩm sinh phía
// Worker (PN-/PX-) khi gộp chung 1 bảng lịch sử trên UI.
function nextStockTxId(type) {
  const seq = parseInt(localStorage.getItem(STOCK_TX_SEQ_KEY) || "0", 10) + 1;
  localStorage.setItem(STOCK_TX_SEQ_KEY, String(seq));
  return (type === "nhap" ? "PNI-" : "PXI-") + String(seq).padStart(6, "0");
}

async function getStockItem(item_type, item_id) {
  if (item_type === "ingredient") return getIngredientById(item_id);
  if (item_type === "product") return await getProductById(item_id);
  return null;
}

// Gộp Nguyên liệu (local) + Sản phẩm (server) thành 1 danh sách cho bảng
// ledger / dropdown chọn hàng.
async function getAllStockItems() {
  const ingredients = loadIngredients().map((i) => ({ ...i, item_type: "ingredient" }));
  const products = (await loadProducts()).map((p) => ({ ...p, item_type: "product" }));
  return [...ingredients, ...products];
}

async function listStockTxRemote(adminToken) {
  const res = await fetch(`${API_BASE_URL}/stock-tx`, { headers: { "X-Admin-Token": adminToken } });
  if (!res.ok) throw new Error("Không tải được sổ Xuất nhập tồn (sản phẩm) từ máy chủ.");
  return res.json();
}

// Hàm DUY NHẤT dùng để đổi tồn kho. delta dương = nhập, âm = xuất.
// meta: { type: "nhap"|"xuat", date, note, source, ref_id }
// adminToken bắt buộc khi item_type === "product" (ghi lên server).
async function adjustStock(item_type, item_id, delta, meta, adminToken) {
  if (item_type === "product") {
    const result = await adjustProductStockRemote(
      item_id,
      { delta, type: meta.type, note: meta.note, source: meta.source, ref_id: meta.ref_id, date: meta.date },
      adminToken
    );
    return { id: result.txId, type: meta.type, item_type, item_id, qty: Math.abs(delta), date: meta.date, note: meta.note, source: meta.source, ref_id: meta.ref_id };
  }

  // Nguyên liệu — local như trước.
  const item = getIngredientById(item_id);
  if (!item) return null;
  const newStock = Math.max(0, Number(item.stock || 0) + delta);
  const list = loadIngredients();
  list.find((i) => i.id === item_id).stock = newStock;
  saveIngredients(list);

  const tx = {
    id: nextStockTxId(meta.type),
    type: meta.type, item_type, item_id, item_name: item.name, unit: item.unit,
    qty: Math.abs(delta), date: meta.date || new Date().toISOString(), note: meta.note || "",
    source: meta.source || "manual", ref_id: meta.ref_id || null,
  };
  const txList = loadStockTx();
  txList.unshift(tx);
  saveStockTx(txList);
  return tx;
}

// Xoá 1 phiếu thủ công — chỉ áp dụng cho source==="manual". Nhận biết
// nguyên liệu (local) hay sản phẩm (server) qua tiền tố mã phiếu (PNI-/PXI-
// = nguyên liệu, PN-/PX- = sản phẩm).
async function deleteStockTx(txId, adminToken) {
  if (txId.startsWith("PNI-") || txId.startsWith("PXI-")) {
    const txList = loadStockTx();
    const tx = txList.find((t) => t.id === txId);
    if (!tx || tx.source !== "manual") return false;

    const revertDelta = tx.type === "nhap" ? -tx.qty : tx.qty;
    const item = getIngredientById(tx.item_id);
    if (item) {
      const newStock = Math.max(0, Number(item.stock || 0) + revertDelta);
      const list = loadIngredients();
      list.find((i) => i.id === tx.item_id).stock = newStock;
      saveIngredients(list);
    }
    saveStockTx(txList.filter((t) => t.id !== txId));
    return true;
  }

  const res = await fetch(`${API_BASE_URL}/stock-tx/${txId}`, { method: "DELETE", headers: { "X-Admin-Token": adminToken } });
  if (!res.ok) return false;
  invalidateProductsCache();
  return true;
}

// Tồn đầu kỳ = tồn thực hiện tại − nhập trong kỳ + xuất trong kỳ (tính ngược
// từ transaction log, giả định không có chỉnh tay tồn kho nào khác ngoài
// phiếu/đơn hàng/sản xuất trong khoảng thời gian đã chọn).
async function computeStockLedger(periodStart, periodEnd, adminToken) {
  const items = await getAllStockItems();
  const remoteTx = await listStockTxRemote(adminToken);
  const allTx = [...loadStockTx(), ...remoteTx];
  const start = new Date(periodStart).getTime();
  const end = new Date(periodEnd).getTime() + 24 * 60 * 60 * 1000 - 1; // hết ngày kết thúc

  return items.map((item) => {
    const txInPeriod = allTx.filter((t) => {
      if (t.item_type !== item.item_type || t.item_id !== item.id) return false;
      const ts = new Date(t.date).getTime();
      return ts >= start && ts <= end;
    });
    const nhap = txInPeriod.filter((t) => t.type === "nhap").reduce((s, t) => s + t.qty, 0);
    const xuat = txInPeriod.filter((t) => t.type === "xuat").reduce((s, t) => s + t.qty, 0);
    const tonThuc = Number(item.stock || 0);
    const tonDauKy = tonThuc - nhap + xuat;
    const tonCuoiKyTinh = tonDauKy + nhap - xuat;
    return {
      item_type: item.item_type, item_id: item.id, name: item.name, unit: item.unit,
      tonDauKy, nhap, xuat, tonCuoiKyTinh, tonThuc, outOfStock: tonThuc <= 0,
    };
  });
}

// Lịch sử phiếu gộp (nguyên liệu + sản phẩm), mới nhất trước — dùng cho
// bảng "Lịch sử phiếu kho" trong khu quản trị.
async function getAllStockTxHistory(adminToken) {
  const remoteTx = await listStockTxRemote(adminToken);
  const merged = [...loadStockTx(), ...remoteTx];
  return merged.sort((a, b) => new Date(b.date) - new Date(a.date));
}
