// =====================================================================
// NHÂN VIÊN — hồ sơ nhân sự dùng cho module Chấm công. Đơn giá công
// (daily_rate) dùng để ước tính lương từ tổng công chấm được trong tháng.
// =====================================================================

const EMPLOYEES_STORE_KEY = "tcp_employees_v1";

function loadEmployees() {
  return JSON.parse(localStorage.getItem(EMPLOYEES_STORE_KEY) || "[]");
}
function saveEmployees(list) {
  localStorage.setItem(EMPLOYEES_STORE_KEY, JSON.stringify(list));
}
function getEmployeeById(id) {
  return loadEmployees().find(e => e.id === id) || null;
}
