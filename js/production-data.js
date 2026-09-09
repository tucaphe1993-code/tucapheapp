// =====================================================================
// SẢN XUẤT — mẻ sản xuất cà phê thành phẩm: tiêu thụ nguyên liệu đầu vào
// (local), tạo ra sản phẩm đầu ra (đồng bộ server qua adjustStock). Mỗi mẻ
// tự động xuất kho nguyên liệu + nhập kho sản phẩm qua adjustStock() (xem
// js/stock-data.js) nên luôn khớp với sổ Xuất nhập tồn — không sửa `stock`
// trực tiếp ở file này. Cần `adminToken` vì phần nhập sản phẩm ghi lên server.
// =====================================================================

const PRODUCTION_STORE_KEY = "tcp_production_v1";
const PRODUCTION_SEQ_KEY = "tcp_production_seq_v1";

function loadProduction() {
  return JSON.parse(localStorage.getItem(PRODUCTION_STORE_KEY) || "[]");
}
function saveProduction(list) {
  localStorage.setItem(PRODUCTION_STORE_KEY, JSON.stringify(list));
}
function nextProductionId() {
  const seq = parseInt(localStorage.getItem(PRODUCTION_SEQ_KEY) || "0", 10) + 1;
  localStorage.setItem(PRODUCTION_SEQ_KEY, String(seq));
  return "SX-" + String(seq).padStart(6, "0");
}

// inputs: [{ ingredient_id, qty }]. Trả về bản ghi mẻ sản xuất đã lưu, hoặc
// null nếu product_id/inputs không hợp lệ.
async function createProductionBatch({ date, product_id, output_qty, note, inputs }, adminToken) {
  const product = await getProductById(product_id);
  if (!product || !output_qty || output_qty <= 0) return null;

  const validInputs = inputs.filter((it) => it.ingredient_id && it.qty > 0);
  if (!validInputs.length) return null;

  const id = nextProductionId();
  for (const it of validInputs) {
    await adjustStock("ingredient", it.ingredient_id, -it.qty, { type: "xuat", date, note: "Sản xuất " + id, source: "production", ref_id: id });
  }
  await adjustStock("product", product_id, output_qty, { type: "nhap", date, note: "Sản xuất " + id, source: "production", ref_id: id }, adminToken);

  const batch = {
    id, date, product_id, product_name: product.name, output_qty, note: note || "",
    inputs: validInputs.map((it) => ({ ...it, ingredient_name: getIngredientById(it.ingredient_id)?.name || "(đã xoá)" })),
  };
  const list = loadProduction();
  list.unshift(batch);
  saveProduction(list);
  return batch;
}

// Xoá mẻ sản xuất: revert đúng chiều (nhập lại nguyên liệu, xuất lại sản
// phẩm). Phiếu kho liên quan (ref_id === batch id) trên server không tự xoá
// (chỉ revert số lượng) — vẫn giữ lại trong lịch sử để truy vết, khác với
// bản cũ (localStorage) vì Worker chưa có endpoint xoá theo ref_id.
async function deleteProductionBatch(id, adminToken) {
  const list = loadProduction();
  const batch = list.find((b) => b.id === id);
  if (!batch) return false;

  for (const it of batch.inputs) {
    await adjustStock("ingredient", it.ingredient_id, it.qty, { type: "nhap", date: new Date().toISOString(), note: "Huỷ mẻ sản xuất " + id, source: "manual" });
  }
  await adjustStock("product", batch.product_id, -batch.output_qty, { type: "xuat", date: new Date().toISOString(), note: "Huỷ mẻ sản xuất " + id, source: "manual" }, adminToken);

  saveProduction(list.filter((b) => b.id !== id));
  return true;
}
