// =====================================================================
// KHÁCH HÀNG — entity riêng (trước đây suy ra tạm từ lịch sử đơn hàng).
// Được tạo/cập nhật tự động mỗi khi có đơn hàng mới ở checkout.js.
// =====================================================================

const CUSTOMERS_STORE_KEY = "tcp_customers_v1";

function loadCustomers() {
  return JSON.parse(localStorage.getItem(CUSTOMERS_STORE_KEY) || "[]");
}
function saveCustomers(list) {
  localStorage.setItem(CUSTOMERS_STORE_KEY, JSON.stringify(list));
}
function getCustomerByPhone(phone) {
  return loadCustomers().find(c => c.phone === phone) || null;
}

// Gọi khi có đơn hàng mới: tạo khách hàng nếu chưa có, cập nhật nếu đã có.
function upsertCustomerFromOrder(order) {
  const list = loadCustomers();
  const existing = list.find(c => c.phone === order.customerPhone);
  if (existing) {
    existing.name = order.customerName;
    existing.company = order.customerCompany || existing.company;
    existing.address = order.address;
    existing.province = order.province;
    existing.orderCount += 1;
    existing.totalSpent += order.total;
    existing.lastOrderAt = order.createdAt;
  } else {
    list.unshift({
      id: "kh-" + Date.now().toString().slice(-6),
      name: order.customerName,
      phone: order.customerPhone,
      company: order.customerCompany || "",
      address: order.address,
      province: order.province,
      orderCount: 1,
      totalSpent: order.total,
      firstOrderAt: order.createdAt,
      lastOrderAt: order.createdAt,
    });
  }
  saveCustomers(list);
}
