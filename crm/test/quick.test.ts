import { describe, it, expect } from "vitest";
import {
  addDays,
  daysLate,
  dueSummary,
  isOverdue,
  kgToPacks,
  matchesFilter,
  nextAction,
  normalizeName,
  pickDefaultVariant,
  sortForList,
  toDateKey,
  totalKg,
  variantLabel,
  weekRange,
  type QuickVariant,
} from "@/lib/quick";
import type { OrderStatus } from "@/types/db";

const TODAY = "2026-09-24"; // Thứ Năm

function v(id: string, form: string | null, packaging: string | null, weight: number | null): QuickVariant {
  return { id, product_id: "p", form, packaging, weight_grams: weight, unit: null, unit_price: 0 };
}

describe("dates", () => {
  it("adds days across month boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays(TODAY, -24)).toBe("2026-08-31");
  });
  it("weekRange runs Monday → Sunday", () => {
    expect(weekRange(TODAY)).toEqual(["2026-09-21", "2026-09-27"]);
    expect(weekRange("2026-09-27")).toEqual(["2026-09-21", "2026-09-27"]); // Chủ nhật
  });
});

describe("matchesFilter", () => {
  const base = { status: "CONFIRMED" as const, delivery_date: null, created_at: "2020-01-01 00:00:00" };

  it("'today' = delivering today, or recorded today without a date", () => {
    expect(matchesFilter({ ...base, delivery_date: TODAY }, "today", TODAY)).toBe(true);
    expect(matchesFilter({ ...base, delivery_date: addDays(TODAY, 1) }, "today", TODAY)).toBe(false);
    const createdNow = new Date().toISOString().replace("T", " ").slice(0, 19);
    expect(matchesFilter({ ...base, created_at: createdNow }, "today", toDateKey(new Date()))).toBe(true);
  });

  it("ignores cancelled orders in date filters", () => {
    expect(matchesFilter({ ...base, status: "CANCELLED", delivery_date: TODAY }, "today", TODAY)).toBe(false);
  });

  it("accepts full ISO delivery dates", () => {
    expect(matchesFilter({ ...base, delivery_date: "2026-09-25T00:00:00.000Z" }, "tomorrow", TODAY)).toBe(true);
  });

  it("open/done split on COMPLETED and CANCELLED", () => {
    expect(matchesFilter({ ...base, status: "SHIPPED" }, "open", TODAY)).toBe(true);
    expect(matchesFilter({ ...base, status: "COMPLETED" }, "open", TODAY)).toBe(false);
    expect(matchesFilter({ ...base, status: "COMPLETED" }, "done", TODAY)).toBe(true);
    expect(matchesFilter({ ...base, status: "CANCELLED" }, "done", TODAY)).toBe(false);
  });
});

describe("sortForList", () => {
  it("puts open orders first, then by delivery date, undated last", () => {
    const rows = [
      { id: "done", status: "COMPLETED" as const, delivery_date: "2026-09-01", created_at: "a" },
      { id: "undated", status: "CONFIRMED" as const, delivery_date: null, created_at: "b" },
      { id: "later", status: "CONFIRMED" as const, delivery_date: "2026-09-26", created_at: "c" },
      { id: "soon", status: "PACKED" as const, delivery_date: "2026-09-24", created_at: "d" },
    ];
    expect(sortForList(rows).map((r) => r.id)).toEqual(["soon", "later", "undated", "done"]);
  });
});

describe("nextAction", () => {
  it("Đã giao cho mọi đơn chưa giao, Hoàn thành cho đơn đã giao", () => {
    for (const s of ["CONFIRMED", "PACKING", "PACKED"] as const) {
      expect(nextAction(s)).toMatchObject({ label: "Đã giao", path: "deliver" });
    }
    expect(nextAction("SHIPPED")).toMatchObject({ label: "Hoàn thành", path: "complete" });
    expect(nextAction("DRAFT")).toBeNull();
    expect(nextAction("COMPLETED")).toBeNull();
    expect(nextAction("CANCELLED")).toBeNull();
  });
});

describe("kgToPacks", () => {
  it("converts kg to whole packs", () => {
    expect(kgToPacks(20, 1000)).toBe(20);
    expect(kgToPacks(5, 500)).toBe(10);
    expect(kgToPacks(0.5, 250)).toBe(2);
  });
  it("rejects amounts that don't fit the pack size", () => {
    expect(kgToPacks(3, 2000)).toBeNull();
    expect(kgToPacks(0.3, 250)).toBeNull();
    expect(kgToPacks(0, 1000)).toBeNull();
  });
});

describe("pickDefaultVariant", () => {
  const variants = [v("b250", "BOT", "TUI_ZIP", 250), v("h1", "HAT", "TUI_XANH", 1000), v("b1", "BOT", "TUI_XANH", 1000)];
  it("prefers the customer's last variant, then the most ordered", () => {
    expect(pickDefaultVariant(variants, { lastForCustomer: "b1", mostOrdered: "b250" })?.id).toBe("b1");
    expect(pickDefaultVariant(variants, { mostOrdered: "b250" })?.id).toBe("b250");
  });
  it("falls back to Hạt · Túi xanh · 1kg", () => {
    expect(pickDefaultVariant(variants)?.id).toBe("h1");
    expect(pickDefaultVariant([])).toBeNull();
  });
});

describe("labels & totals", () => {
  it("labels variants and sums kg", () => {
    expect(variantLabel(v("x", "HAT", "TUI_XANH", 1000))).toBe("Hạt · Túi xanh · 1kg");
    expect(variantLabel(v("x", "BOT", "TUI_ZIP", 250))).toBe("Bột · Túi zip · 250g");
    expect(totalKg([{ weight_grams: 1000, quantity: 20 }, { weight_grams: 250, quantity: 2 }, { weight_grams: null, quantity: 1 }])).toBe(20.5);
  });
  it("normalizes Vietnamese names for search", () => {
    expect(normalizeName("  Anh   Đức Huy ")).toBe("anh duc huy");
  });
});

describe("nhắc việc (Phase 4)", () => {
  const o = (status: OrderStatus, delivery_date: string | null) => ({
    status,
    delivery_date,
    created_at: "2020-01-01 00:00:00",
  });

  it("đếm đơn cần xử lý hôm nay và đơn trễ hạn, bỏ đơn đã xong/hủy", () => {
    const orders = [
      o("CONFIRMED", TODAY),
      o("SHIPPED", TODAY), // đã giao nhưng chưa bấm Hoàn thành → vẫn nhắc
      o("COMPLETED", TODAY),
      o("CONFIRMED", "2026-09-22"),
      o("CANCELLED", "2026-09-22"),
      o("CONFIRMED", addDays(TODAY, 1)),
      o("CONFIRMED", null),
    ];
    expect(dueSummary(orders, TODAY)).toEqual({ dueToday: 2, overdue: 1 });
  });

  it("đơn trễ hạn vẫn hiện trong tab Hôm nay", () => {
    expect(matchesFilter(o("PACKED", "2026-09-20"), "today", TODAY)).toBe(true);
    expect(matchesFilter(o("COMPLETED", "2026-09-20"), "today", TODAY)).toBe(false);
    expect(isOverdue(o("CONFIRMED", "2026-09-23T10:00:00.000Z"), TODAY)).toBe(true);
  });

  it("tính số ngày trễ", () => {
    expect(daysLate("2026-09-22", TODAY)).toBe(2);
    expect(daysLate("2026-08-31", "2026-09-01")).toBe(1);
    expect(daysLate(TODAY, TODAY)).toBe(0);
  });
});

describe("công việc hẹn nhanh (quick_jobs)", () => {
  const job = (status: "OPEN" | "DONE" | "CANCELLED", due_date: string | null) => ({
    status,
    due_date,
    created_at: "2020-01-01 00:00:00",
  });

  it("lọc giống đơn hàng: hẹn hôm nay, ngày mai, trễ hạn", () => {
    expect(matchesFilter(job("OPEN", TODAY), "today", TODAY)).toBe(true);
    expect(matchesFilter(job("OPEN", addDays(TODAY, 1)), "tomorrow", TODAY)).toBe(true);
    expect(matchesFilter(job("OPEN", "2026-09-20"), "today", TODAY)).toBe(true); // trễ hạn
    expect(matchesFilter(job("DONE", "2026-09-20"), "today", TODAY)).toBe(false);
    expect(matchesFilter(job("CANCELLED", TODAY), "today", TODAY)).toBe(false);
    expect(matchesFilter(job("OPEN", null), "open", TODAY)).toBe(true);
    expect(matchesFilter(job("DONE", null), "done", TODAY)).toBe(true);
  });

  it("đếm việc hẹn hôm nay và việc trễ", () => {
    const jobs = [job("OPEN", TODAY), job("DONE", TODAY), job("OPEN", "2026-09-01"), job("OPEN", null)];
    expect(dueSummary(jobs, TODAY)).toEqual({ dueToday: 1, overdue: 1 });
  });
});
