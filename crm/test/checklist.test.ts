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
  it("creates one required line per order item plus the two fixed checks", () => {
    const lines = buildChecklistLabels([item({}), item({ sku: "HR-B-ZIP-1000" })]);
    expect(lines).toHaveLength(4);
    expect(lines.filter((l) => l.required)).toHaveLength(4);
    expect(lines.at(-2)?.label).toBe("Dán tem sản phẩm");
    expect(lines.at(-1)?.label).toBe("Kiểm tra địa chỉ giao hàng");
  });

  it("includes the SKU and quantity in each line's label", () => {
    const [line] = buildChecklistLabels([item({ sku: "CB-H-XANH-500", quantity: 3 })]);
    expect(line.label).toContain("CB-H-XANH-500");
    expect(line.label).toContain("x 3");
  });

  it("produces no checklist lines for an order with no items", () => {
    const lines = buildChecklistLabels([]);
    expect(lines).toEqual([
      { label: "Dán tem sản phẩm", required: true },
      { label: "Kiểm tra địa chỉ giao hàng", required: true },
    ]);
  });
});
