// TÚ QUICK — logic thuần (không đụng DB) cho màn ghi đơn nhanh /quick.
// Dữ liệu vẫn là đơn hàng/khách hàng/công nợ thật của CRM; file này chỉ lo
// lọc, gom nhóm và quy đổi để hiển thị/nhập liệu nhanh trên điện thoại.

import type { OrderStatus } from "@/types/db";

// ===== NGÀY (luôn là chuỗi 'YYYY-MM-DD' theo giờ máy người dùng) =====

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return toDateKey(new Date(y, m - 1, d + days));
}

/** Thứ Hai → Chủ nhật của tuần chứa `key`. */
export function weekRange(key: string): [string, string] {
  const [y, m, d] = key.split("-").map(Number);
  const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7; // 0 = Thứ Hai
  const start = addDays(key, -weekday);
  return [start, addDays(start, 6)];
}

/** created_at của D1 là UTC dạng 'YYYY-MM-DD HH:MM:SS' → ngày theo giờ máy. */
export function createdDateKey(createdAt: string): string {
  const iso = createdAt.includes("T") ? createdAt : createdAt.replace(" ", "T") + "Z";
  return toDateKey(new Date(iso));
}

/** delivery_date có thể là 'YYYY-MM-DD' hoặc ISO đầy đủ — chỉ lấy phần ngày. */
export function deliveryKey(deliveryDate: string | null): string | null {
  return deliveryDate ? deliveryDate.slice(0, 10) : null;
}

export function formatDayMonth(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

export function formatFullDate(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

export function relativeDayLabel(key: string, today: string): string {
  if (key === today) return "Hôm nay";
  if (key === addDays(today, 1)) return "Ngày mai";
  if (key === addDays(today, 2)) return "Ngày kia";
  if (key === addDays(today, -1)) return "Hôm qua";
  return formatDayMonth(key);
}

// ===== TRẠNG THÁI ĐƠN =====

/** Đơn chưa xuất kho — khớp "đơn cần xử lý" trên Dashboard CRM. */
export const PENDING_STATUSES: OrderStatus[] = ["CONFIRMED", "PACKING", "PACKED"];

export function isOpenStatus(status: OrderStatus): boolean {
  return status !== "COMPLETED" && status !== "CANCELLED";
}

/**
 * Bước kế tiếp bấm được ngay từ danh sách — chỉ gọi đúng các API chuyển
 * trạng thái CRM đã có (xuất kho trừ tồn, hoàn thành), không tự đổi status.
 * CONFIRMED/PACKING cần giao việc/đóng gói (có checklist, ảnh) nên mở trang
 * chi tiết đơn của CRM.
 */
export type QuickAction =
  | { kind: "api"; label: string; path: "ship" | "complete"; confirm?: string }
  | { kind: "open"; label: string };

export function nextAction(status: OrderStatus): QuickAction | null {
  switch (status) {
    case "PACKED":
      return {
        kind: "api",
        label: "Xuất kho",
        path: "ship",
        confirm: "Xuất kho đơn này? Tồn kho sẽ bị trừ và không hoàn tác được.",
      };
    case "SHIPPED":
      return { kind: "api", label: "Hoàn thành", path: "complete" };
    case "DRAFT":
    case "CONFIRMED":
      return { kind: "open", label: "Giao việc" };
    case "PACKING":
      return { kind: "open", label: "Đang đóng gói" };
    default:
      return null;
  }
}

// ===== BỘ LỌC =====

export const QUICK_FILTERS = [
  { key: "today", label: "Hôm nay" },
  { key: "tomorrow", label: "Ngày mai" },
  { key: "week", label: "Tuần này" },
  { key: "open", label: "Chưa hoàn thành" },
  { key: "done", label: "Đã hoàn thành" },
] as const;
export type QuickFilter = (typeof QUICK_FILTERS)[number]["key"];

export interface FilterableOrder {
  status: OrderStatus;
  delivery_date: string | null;
  created_at: string;
}

export function matchesFilter(o: FilterableOrder, filter: QuickFilter, today: string): boolean {
  const d = deliveryKey(o.delivery_date);
  switch (filter) {
    case "today":
      // Giao hôm nay + đơn vừa ghi hôm nay chưa hẹn ngày; bỏ đơn đã hủy.
      return o.status !== "CANCELLED" && (d === today || (!d && createdDateKey(o.created_at) === today));
    case "tomorrow":
      return o.status !== "CANCELLED" && d === addDays(today, 1);
    case "week": {
      const [start, end] = weekRange(today);
      return o.status !== "CANCELLED" && !!d && d >= start && d <= end;
    }
    case "open":
      return isOpenStatus(o.status);
    case "done":
      return o.status === "COMPLETED";
  }
}

/** Đơn đang mở lên trước, rồi theo ngày giao (chưa hẹn xếp cuối), rồi mới ghi trước. */
export function sortForList<T extends FilterableOrder>(orders: T[]): T[] {
  return [...orders].sort((a, b) => {
    const open = Number(isOpenStatus(b.status)) - Number(isOpenStatus(a.status));
    if (open) return open;
    const da = deliveryKey(a.delivery_date) ?? "9999-99-99";
    const db = deliveryKey(b.delivery_date) ?? "9999-99-99";
    if (da !== db) return da < db ? -1 : 1;
    return b.created_at.localeCompare(a.created_at);
  });
}

// ===== QUY CÁCH / SỐ LƯỢNG =====

export interface QuickVariant {
  id: string;
  product_id: string;
  form: string | null;
  packaging: string | null;
  weight_grams: number | null;
  unit: string | null;
  unit_price: number;
}

const FORM_LABEL: Record<string, string> = { HAT: "Hạt", BOT: "Bột" };
const PACKAGING_LABEL: Record<string, string> = { TUI_XANH: "Túi xanh", TUI_ZIP: "Túi zip" };

export function formatWeight(grams: number): string {
  return grams % 1000 === 0 ? `${grams / 1000}kg` : grams >= 1000 ? `${grams / 1000}kg` : `${grams}g`;
}

export function variantLabel(v: QuickVariant): string {
  const parts = [
    v.form ? (FORM_LABEL[v.form] ?? v.form) : null,
    v.packaging ? (PACKAGING_LABEL[v.packaging] ?? v.packaging) : null,
    v.weight_grams ? formatWeight(v.weight_grams) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : (v.unit ?? "Mặc định");
}

/**
 * Người dùng nói theo KG ("20 ký") còn CRM bán theo túi (order_items.quantity
 * là số túi, nguyên). Trả về số túi, hoặc null nếu KG không chia hết cho
 * quy cách túi (vd 3kg với túi 2kg).
 */
export function kgToPacks(kg: number, weightGrams: number): number | null {
  if (!(kg > 0) || !(weightGrams > 0)) return null;
  const packs = (kg * 1000) / weightGrams;
  const rounded = Math.round(packs);
  return Math.abs(packs - rounded) < 1e-9 && rounded > 0 ? rounded : null;
}

/**
 * Quy cách mặc định khi chọn sản phẩm: lần gần nhất khách này mua sản phẩm
 * đó → quy cách bán nhiều nhất → Hạt · Túi xanh · 1kg → quy cách đầu tiên.
 */
export function pickDefaultVariant(
  variants: QuickVariant[],
  opts: { lastForCustomer?: string | null; mostOrdered?: string | null } = {}
): QuickVariant | null {
  if (!variants.length) return null;
  const byId = (id?: string | null) => (id ? variants.find((v) => v.id === id) : undefined);
  return (
    byId(opts.lastForCustomer) ??
    byId(opts.mostOrdered) ??
    variants.find((v) => v.form === "HAT" && v.packaging === "TUI_XANH" && v.weight_grams === 1000) ??
    variants.find((v) => v.weight_grams === 1000) ??
    variants[0]
  );
}

/** Tổng KG của các dòng hàng có quy cách khối lượng (thiết bị không tính). */
export function totalKg(items: { weight_grams: number | null; quantity: number }[]): number {
  return items.reduce((sum, i) => sum + (i.weight_grams ? (i.weight_grams * i.quantity) / 1000 : 0), 0);
}

/** Bỏ dấu tiếng Việt để tìm khách kiểu "huy" ra "A Huy". */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}
