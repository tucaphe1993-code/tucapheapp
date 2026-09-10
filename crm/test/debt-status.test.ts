import { describe, it, expect } from "vitest";
import { computeDebtStatus } from "@/lib/services/debts";

const NOW = new Date("2026-09-10T00:00:00Z");

describe("computeDebtStatus", () => {
  it("is UNPAID when nothing has been paid and there's no overdue due date", () => {
    expect(
      computeDebtStatus({ totalAmount: 100000, paidAmount: 0, dueDate: null, now: NOW })
    ).toBe("UNPAID");
  });

  it("is PARTIAL once some but not all has been paid", () => {
    expect(
      computeDebtStatus({ totalAmount: 100000, paidAmount: 40000, dueDate: null, now: NOW })
    ).toBe("PARTIAL");
  });

  it("is PAID once the paid amount reaches or exceeds the total", () => {
    expect(
      computeDebtStatus({ totalAmount: 100000, paidAmount: 100000, dueDate: null, now: NOW })
    ).toBe("PAID");
    expect(
      computeDebtStatus({ totalAmount: 100000, paidAmount: 150000, dueDate: null, now: NOW })
    ).toBe("PAID");
  });

  it("is OVERDUE when unpaid past the due date, even if partially paid", () => {
    expect(
      computeDebtStatus({
        totalAmount: 100000,
        paidAmount: 0,
        dueDate: "2026-09-01T00:00:00Z",
        now: NOW,
      })
    ).toBe("OVERDUE");
    expect(
      computeDebtStatus({
        totalAmount: 100000,
        paidAmount: 40000,
        dueDate: "2026-09-01T00:00:00Z",
        now: NOW,
      })
    ).toBe("OVERDUE");
  });

  it("is not OVERDUE when the due date hasn't passed yet", () => {
    expect(
      computeDebtStatus({
        totalAmount: 100000,
        paidAmount: 0,
        dueDate: "2026-09-20T00:00:00Z",
        now: NOW,
      })
    ).toBe("UNPAID");
  });

  it("a fully paid order is PAID even past its due date", () => {
    expect(
      computeDebtStatus({
        totalAmount: 100000,
        paidAmount: 100000,
        dueDate: "2026-09-01T00:00:00Z",
        now: NOW,
      })
    ).toBe("PAID");
  });
});
