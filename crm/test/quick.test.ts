import { describe, it, expect } from "vitest";
import {
  addDays,
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
  it("only offers the CRM's real transitions", () => {
    expect(nextAction("PACKED")).toMatchObject({ kind: "api", path: "ship" });
    expect(nextAction("SHIPPED")).toMatchObject({ kind: "api", path: "complete" });
    expect(nextAction("CONFIRMED")).toMatchObject({ kind: "open" });
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
