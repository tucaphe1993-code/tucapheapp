// TÚ QUICK — logic thuần (không đụng DB) cho màn ghi đơn nhanh /quick.
// Dữ liệu vẫn là đơn hàng/khách hàng/công nợ thật của CRM; file này chỉ lo
// lọc, gom nhóm và quy đổi để hiển thị/nhập liệu nhanh trên điện thoại.

import type { OrderStatus, QuickJobStatus } from "@/types/db";

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
 * Nút bấm nhanh trên từng dòng đơn — gọi đúng API chuyển trạng thái của CRM:
 *  - Chưa giao (Đã xác nhận / Đang đóng gói / Đã đóng gói) → "Đã giao"
 *    (/deliver: xuất kho thẳng, trừ tồn, bỏ qua giao việc đóng gói).
 *  - Đã giao → "Hoàn thành".
 * Nháp / hoàn thành / đã hủy: không có nút (mở trang đơn để xử lý).
 */
export interface QuickAction {
  label: string;
  path: "deliver" | "complete" | "undeliver" | "reopen";
  confirm?: string;
}

export function nextAction(status: OrderStatus): QuickAction | null {
  switch (status) {
    case "CONFIRMED":
    case "PACKING":
    case "PACKED":
      return {
        label: "Đã giao",
        path: "deliver",
        confirm: "Đánh dấu ĐÃ GIAO? Kho sẽ bị trừ theo đơn này (bấm nhầm thì dùng Hoàn lại).",
      };
    case "SHIPPED":
      return { label: "Hoàn thành", path: "complete" };
    default:
      return null;
  }
}

/**
 * "Hoàn lại" khi lỡ bấm: Đã giao → về Đã xác nhận (cộng trả kho, /undeliver);
 * Hoàn thành → về Đã giao (/reopen).
 */
export function undoAction(status: OrderStatus): QuickAction | null {
  switch (status) {
    case "SHIPPED":
      return {
        label: "Hoàn lại",
        path: "undeliver",
        confirm: "Hoàn lại đơn về CHƯA GIAO? Kho sẽ được cộng trả lại số đã trừ.",
      };
    case "COMPLETED":
      return { label: "Hoàn lại", path: "reopen", confirm: "Mở lại đơn về ĐÃ GIAO?" };
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

/** Công việc hẹn nhanh (bảng quick_jobs) — lọc/nhắc y như đơn hàng. */
export interface FilterableJob {
  status: QuickJobStatus;
  due_date: string | null;
  created_at: string;
}

export type Filterable = FilterableOrder | FilterableJob;

function scheduleOf(x: Filterable): { date: string | null; open: boolean; done: boolean; cancelled: boolean } {
  if ("due_date" in x) {
    return { date: deliveryKey(x.due_date), open: x.status === "OPEN", done: x.status === "DONE", cancelled: x.status === "CANCELLED" };
  }
  return {
    date: deliveryKey(x.delivery_date),
    open: isOpenStatus(x.status),
    done: x.status === "COMPLETED",
    cancelled: x.status === "CANCELLED",
  };
}

export function matchesFilter(x: Filterable, filter: QuickFilter, today: string): boolean {
  const { date: d, open, done, cancelled } = scheduleOf(x);
  switch (filter) {
    case "today":
      // Hẹn hôm nay + vừa ghi hôm nay chưa hẹn ngày + TRỄ HẠN chưa xong (để
      // việc quên làm không bị rơi khỏi màn hình chính); bỏ đơn/việc đã hủy.
      return !cancelled && (d === today || (!d && createdDateKey(x.created_at) === today) || isOverdue(x, today));
    case "tomorrow":
      return !cancelled && d === addDays(today, 1);
    case "week": {
      const [start, end] = weekRange(today);
      return !cancelled && !!d && d >= start && d <= end;
    }
    case "open":
      return open;
    case "done":
      return done;
  }
}

/** Chưa xong mà ngày hẹn/ngày giao đã qua. */
export function isOverdue(x: Filterable, today: string): boolean {
  const { date, open } = scheduleOf(x);
  return !!date && date < today && open;
}

/** Ngày hẹn ('YYYY-MM-DD') của đơn hoặc việc. */
export function scheduledDate(x: Filterable): string | null {
  return scheduleOf(x).date;
}

export function isOpenItem(x: Filterable): boolean {
  return scheduleOf(x).open;
}

/** Số ngày trễ so với ngày giao (0 nếu không trễ). */
export function daysLate(deliveryDate: string, today: string): number {
  const [y1, m1, d1] = deliveryDate.slice(0, 10).split("-").map(Number);
  const [y2, m2, d2] = today.split("-").map(Number);
  return Math.max(0, Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000));
}

/**
 * Nhắc việc khi mở app: đơn chưa xong có ngày giao hôm nay, và đơn trễ hạn.
 * "Chưa xong" gồm cả Đã giao (SHIPPED) — vẫn cần bấm Hoàn thành.
 */
export function dueSummary(items: Filterable[], today: string): { dueToday: number; overdue: number } {
  let dueToday = 0;
  let overdue = 0;
  for (const x of items) {
    const { date: d, open } = scheduleOf(x);
    if (!open) continue;
    if (d === today) dueToday++;
    else if (d && d < today) overdue++;
  }
  return { dueToday, overdue };
}

/** Đơn đang mở lên trước, rồi theo ngày giao (chưa hẹn xếp cuối), rồi mới ghi trước. */
export function sortForList<T extends Filterable>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const open = Number(isOpenItem(b)) - Number(isOpenItem(a));
    if (open) return open;
    const da = scheduledDate(a) ?? "9999-99-99";
    const db = scheduledDate(b) ?? "9999-99-99";
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
