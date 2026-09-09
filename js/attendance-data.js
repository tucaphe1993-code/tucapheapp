// =====================================================================
// CHẤM CÔNG — mỗi bản ghi là 1 ngày công của 1 nhân viên. "Công" tính theo
// đơn vị ngày (0.5 = nửa ngày, 1 = cả ngày, 1.5 = có tăng ca) — đơn giản hơn
// chấm giờ vào/ra, phù hợp quy mô quán/cơ sở nhỏ.
// =====================================================================

const ATTENDANCE_STORE_KEY = "tcp_attendance_v1";

function loadAttendance() {
  return JSON.parse(localStorage.getItem(ATTENDANCE_STORE_KEY) || "[]");
}
function saveAttendance(list) {
  localStorage.setItem(ATTENDANCE_STORE_KEY, JSON.stringify(list));
}

// month dạng "YYYY-MM". Trả về [{ employee_id, employee_name, totalCong, estimatedPay }]
function getMonthlyAttendanceSummary(month) {
  const records = loadAttendance().filter(r => r.date.startsWith(month));
  const employees = loadEmployees();
  const byEmployee = new Map();
  records.forEach(r => {
    byEmployee.set(r.employee_id, (byEmployee.get(r.employee_id) || 0) + Number(r.cong));
  });
  return [...byEmployee.entries()].map(([employee_id, totalCong]) => {
    const emp = employees.find(e => e.id === employee_id);
    return {
      employee_id,
      employee_name: emp ? emp.name : "(đã xoá)",
      totalCong,
      estimatedPay: emp ? totalCong * Number(emp.daily_rate || 0) : 0,
    };
  });
}
