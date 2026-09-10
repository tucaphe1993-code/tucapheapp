import { describe, it, expect } from "vitest";
import { buildChecklistLabels } from "@/lib/services/tasks";
import type { OrderItemRow } from "@/types/db";

function item(overrides: Partial<OrderItemRow>): OrderItemRow {
  return {
    id: "i1",
    order_id: "o1",
    product_variant_id: "v1",
    sku: "CB-H-XANH-500",
    product_name: "Crema Blend",
    form: "HAT",
    packaging: "TUI_XANH",
    weight_grams: 500,
    quantity: 2,
    unit_price: 140000,
    line_total: 280000,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("packing checklist generation", () => {
  it("always produces the two fixed required checks, regardless of line items", () => {
    const lines = buildChecklistLabels([item({}), item({ sku: "HR-B-ZIP-1000" })]);
    expect(lines).toEqual([
      { label: "Đủ số lượng", required: true },
      { label: "Đã ghi tên khách hàng đầy đủ", required: true },
    ]);
  });

  it("produces the same two checks for an order with no items", () => {
    const lines = buildChecklistLabels([]);
    expect(lines).toEqual([
      { label: "Đủ số lượng", required: true },
      { label: "Đã ghi tên khách hàng đầy đủ", required: true },
    ]);
  });
});
