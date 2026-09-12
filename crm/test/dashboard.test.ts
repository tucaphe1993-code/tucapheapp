import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb } from "./d1-shim";
import {
  getPeriodRange,
  deltaPercent,
  getRevenueProfitTotals,
  getRevenueSeries,
  getDebtSummary,
  getOrderStatusBuckets,
  getTopProducts,
  getCoffeeStock,
} from "@/lib/services/dashboard";

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000);
}

describe("getPeriodRange", () => {
  const now = new Date("2026-01-10T12:00:00Z");

  it("7d/30d end today and span exactly 7/30 days, with an equal-length prior period", () => {
    for (const [period, span] of [["7d", 7], ["30d", 30]] as const) {
      const r = getPeriodRange(period, now);
      expect(r.end).toBe("2026-01-10");
      expect(daysBetween(r.start, r.end) + 1).toBe(span);
      expect(daysBetween(r.prevStart, r.prevEnd) + 1).toBe(span);
      // prevEnd must be exactly the day before start — no gap, no overlap.
      expect(daysBetween(r.prevEnd, r.start)).toBe(1);
    }
  });

  it("this_month starts on the 1st and ends today", () => {
    const r = getPeriodRange("this_month", now);
    expect(r.start).toBe("2026-01-01");
    expect(r.end).toBe("2026-01-10");
    expect(daysBetween(r.prevEnd, r.start)).toBe(1);
    expect(daysBetween(r.prevStart, r.prevEnd) + 1).toBe(daysBetween(r.start, r.end) + 1);
  });

  it("last_month resolves to the full previous calendar month, including a Feb 29 in a leap year", () => {
    const leapNow = new Date("2024-03-05T12:00:00Z");
    const r = getPeriodRange("last_month", leapNow);
    expect(r.start).toBe("2024-02-01");
    expect(r.end).toBe("2024-02-29");
    // the period right before Feb 2024 is January 2024, of equal length (29 days)
    expect(r.prevEnd).toBe("2024-01-31");
    expect(daysBetween(r.prevStart, r.prevEnd) + 1).toBe(29);
  });
});

describe("deltaPercent", () => {
  it("returns null when there is no baseline to compare against", () => {
    expect(deltaPercent(500000, 0)).toBeNull();
    expect(deltaPercent(0, 0)).toBeNull();
  });

  it("computes a signed percentage change against a real baseline", () => {
    expect(deltaPercent(150, 100)).toBe(50);
    expect(deltaPercent(50, 100)).toBe(-50);
  });
});

let db: D1Database;
let userId: string;
let customerId: string;
let coffeeProductId: string;
let coffeeVariantId: string; // cost 100k, price 150k
let brewerProductId: string;
let brewerVariantId: string; // cost 30M, price 45M

beforeEach(async () => {
  db = createTestDb();
  userId = randomUUID();
  customerId = randomUUID();

  await db
    .prepare(
      `INSERT INTO users (id, email, full_name, password_hash, password_salt, role) VALUES (?, ?, ?, 'x', 'y', 'ADMIN')`
    )
    .bind(userId, "admin@test.local", "Admin Test")
    .run();
  await db.prepare(`INSERT INTO customers (id, name) VALUES (?, 'KH Test')`).bind(customerId).run();

  coffeeProductId = randomUUID();
  coffeeVariantId = randomUUID();
  await db
    .prepare(`INSERT INTO products (id, name, slug, code, product_type) VALUES (?, 'Robotech', 'robotech', 'ROB', 'COFFEE')`)
    .bind(coffeeProductId)
    .run();
  await db
    .prepare(
      `INSERT INTO product_variants (id, product_id, form, packaging, weight_grams, sku, unit, unit_price, cost_price)
       VALUES (?, ?, 'HAT', 'TUI_ZIP', 1000, 'ROB-H-ZIP-1KG', 'Túi', 150000, 100000)`
    )
    .bind(coffeeVariantId, coffeeProductId)
    .run();
  await db
    .prepare(`INSERT INTO inventory (id, product_variant_id, sku, quantity_on_hand, low_stock_threshold) VALUES (?, ?, 'ROB-H-ZIP-1KG', 50, 10)`)
    .bind(randomUUID(), coffeeVariantId)
    .run();

  brewerProductId = randomUUID();
  brewerVariantId = randomUUID();
  await db
    .prepare(`INSERT INTO products (id, name, slug, code, product_type) VALUES (?, 'LAMVITA', 'lamvita', 'LAM', 'BREWER')`)
    .bind(brewerProductId)
    .run();
  await db
    .prepare(
      `INSERT INTO product_variants (id, product_id, sku, unit, unit_price, cost_price)
       VALUES (?, ?, 'LAM-SKU', 'Máy', 45000000, 30000000)`
    )
    .bind(brewerVariantId, brewerProductId)
    .run();
});

async function insertOrder(params: { day: string; variantId: string; sku: string; qty: number; unitPrice: number; status?: string }) {
  const orderId = randomUUID();
  const lineTotal = params.qty * params.unitPrice;
  await db
    .prepare(
      `INSERT INTO orders (id, order_code, customer_id, status, total_amount, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(orderId, `DH-${orderId.slice(0, 6)}`, customerId, params.status ?? "CONFIRMED", lineTotal, userId, `${params.day} 10:00:00`)
    .run();
  await db
    .prepare(
      `INSERT INTO order_items (id, order_id, product_variant_id, sku, product_name, quantity, unit_price, line_total)
       VALUES (?, ?, ?, ?, 'x', ?, ?, ?)`
    )
    .bind(randomUUID(), orderId, params.variantId, params.sku, params.qty, params.unitPrice, lineTotal)
    .run();
  return orderId;
}

describe("getRevenueProfitTotals / getRevenueSeries", () => {
  it("computes profit as line_total minus quantity * cost_price, and skips cancelled orders", async () => {
    await insertOrder({ day: "2026-01-05", variantId: coffeeVariantId, sku: "ROB-H-ZIP-1KG", qty: 2, unitPrice: 150000 });
    await insertOrder({ day: "2026-01-05", variantId: brewerVariantId, sku: "LAM-SKU", qty: 1, unitPrice: 45000000, status: "CANCELLED" });

    const totals = await getRevenueProfitTotals(db, "2026-01-01", "2026-01-31");
    expect(totals.revenue).toBe(300000);
    expect(totals.profit).toBe(100000); // (150000-100000) * 2
  });

  it("fills every day in range with zeros when there is no data that day", async () => {
    await insertOrder({ day: "2026-01-05", variantId: coffeeVariantId, sku: "ROB-H-ZIP-1KG", qty: 1, unitPrice: 150000 });
    const series = await getRevenueSeries(db, "2026-01-04", "2026-01-06");
    expect(series).toEqual([
      { day: "2026-01-04", revenue: 0, profit: 0 },
      { day: "2026-01-05", revenue: 150000, profit: 50000 },
      { day: "2026-01-06", revenue: 0, profit: 0 },
    ]);
  });
});

describe("getDebtSummary", () => {
  it("sums outstanding balances and separates the overdue portion", async () => {
    const paidOrderId = await insertOrder({ day: "2026-01-01", variantId: coffeeVariantId, sku: "ROB-H-ZIP-1KG", qty: 1, unitPrice: 150000 });
    await db.prepare(`INSERT INTO payments (id, order_id, customer_id, amount) VALUES (?, ?, ?, 150000)`).bind(randomUUID(), paidOrderId, customerId).run();

    const overdueOrderId = await insertOrder({ day: "2026-01-01", variantId: coffeeVariantId, sku: "ROB-H-ZIP-1KG", qty: 2, unitPrice: 150000 });
    await db.prepare(`UPDATE orders SET payment_due_date = '2020-01-01' WHERE id = ?`).bind(overdueOrderId).run();

    await insertOrder({ day: "2026-01-01", variantId: coffeeVariantId, sku: "ROB-H-ZIP-1KG", qty: 1, unitPrice: 150000, status: "CANCELLED" });

    const summary = await getDebtSummary(db);
    expect(summary.totalDebt).toBe(300000); // only the overdue order's 300000 remains unpaid
    expect(summary.overdueDebt).toBe(300000);
    expect(summary.overdueCount).toBe(1);
  });
});

describe("getOrderStatusBuckets", () => {
  it("merges PACKING+PACKED and SHIPPED+COMPLETED, and excludes DRAFT from the total", async () => {
    await insertOrder({ day: "2026-01-01", variantId: coffeeVariantId, sku: "ROB-H-ZIP-1KG", qty: 1, unitPrice: 150000, status: "CONFIRMED" });
    await insertOrder({ day: "2026-01-01", variantId: coffeeVariantId, sku: "ROB-H-ZIP-1KG", qty: 1, unitPrice: 150000, status: "PACKING" });
    await insertOrder({ day: "2026-01-01", variantId: coffeeVariantId, sku: "ROB-H-ZIP-1KG", qty: 1, unitPrice: 150000, status: "PACKED" });
    await insertOrder({ day: "2026-01-01", variantId: coffeeVariantId, sku: "ROB-H-ZIP-1KG", qty: 1, unitPrice: 150000, status: "SHIPPED" });
    await insertOrder({ day: "2026-01-01", variantId: coffeeVariantId, sku: "ROB-H-ZIP-1KG", qty: 1, unitPrice: 150000, status: "COMPLETED" });
    await insertOrder({ day: "2026-01-01", variantId: coffeeVariantId, sku: "ROB-H-ZIP-1KG", qty: 1, unitPrice: 150000, status: "CANCELLED" });
    await insertOrder({ day: "2026-01-01", variantId: coffeeVariantId, sku: "ROB-H-ZIP-1KG", qty: 1, unitPrice: 150000, status: "DRAFT" });

    const buckets = await getOrderStatusBuckets(db);
    expect(buckets).toEqual({ confirmed: 1, packing: 2, shipped: 2, cancelled: 1, total: 6 });
  });
});

describe("getTopProducts", () => {
  it("ranks by revenue within a category and computes share against that category's own total", async () => {
    await insertOrder({ day: "2026-01-05", variantId: coffeeVariantId, sku: "ROB-H-ZIP-1KG", qty: 2, unitPrice: 150000 }); // 300000
    await insertOrder({ day: "2026-01-06", variantId: brewerVariantId, sku: "LAM-SKU", qty: 1, unitPrice: 45000000 }); // 45000000

    const coffeeTop = await getTopProducts(db, "COFFEE", "2026-01-01", "2026-01-31");
    expect(coffeeTop).toHaveLength(1);
    expect(coffeeTop[0].label).toBe("Robotech 1kg");
    expect(coffeeTop[0].revenue).toBe(300000);
    expect(coffeeTop[0].share).toBe(100);

    const otherTop = await getTopProducts(db, "OTHER", "2026-01-01", "2026-01-31");
    expect(otherTop).toHaveLength(1);
    expect(otherTop[0].label).toBe("LAMVITA");
    expect(otherTop[0].revenue).toBe(45000000);

    const allTop = await getTopProducts(db, "ALL", "2026-01-01", "2026-01-31");
    expect(allTop.map((t) => t.label)).toEqual(["LAMVITA", "Robotech 1kg"]);
  });
});

describe("getCoffeeStock", () => {
  it("converts unit-based inventory to kg using each variant's real weight, for COFFEE only", async () => {
    const stock = await getCoffeeStock(db);
    expect(stock.finishedKg).toBe(50); // 50 túi * 1000g / 1000
    expect(stock.lowStockCount).toBe(0);
  });
});
