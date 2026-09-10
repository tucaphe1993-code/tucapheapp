import { describe, it, expect } from "vitest";
import { buildSkuFromCode, weightSuffix, nextOrderCode } from "@/lib/db/id";
import { createTestDb } from "./d1-shim";

describe("SKU generation", () => {
  it("matches the spec example: Crema Blend, Hạt, Túi Xanh, 500g -> CB-H-XANH-500", () => {
    expect(buildSkuFromCode("CB", "HAT", "TUI_XANH", 500)).toBe("CB-H-XANH-500");
  });

  it("matches the spec example: Crema Blend, Bột, Túi Zip, 500g -> CB-B-ZIP-500", () => {
    expect(buildSkuFromCode("CB", "BOT", "TUI_ZIP", 500)).toBe("CB-B-ZIP-500");
  });

  it("keeps sub-kilogram weights as plain grams", () => {
    expect(weightSuffix(250)).toBe("250");
  });

  it("formats kilogram-and-above weights as NKG so future 2/5/10kg sizes need no schema change", () => {
    expect(weightSuffix(1000)).toBe("1KG");
    expect(weightSuffix(2000)).toBe("2KG");
    expect(weightSuffix(5000)).toBe("5KG");
    expect(weightSuffix(10000)).toBe("10KG");
  });

  it("never collides two different variants onto the same SKU", () => {
    const a = buildSkuFromCode("HR", "HAT", "TUI_XANH", 250);
    const b = buildSkuFromCode("HR", "BOT", "TUI_XANH", 250);
    const c = buildSkuFromCode("HR", "HAT", "TUI_ZIP", 250);
    const d = buildSkuFromCode("HR", "HAT", "TUI_XANH", 500);
    expect(new Set([a, b, c, d]).size).toBe(4);
  });
});

describe("sequential order code generation", () => {
  it("produces the readable DH-#### shape, starting at DH-0001 on a fresh DB", async () => {
    const db = createTestDb();
    expect(await nextOrderCode(db)).toBe("DH-0001");
    expect(await nextOrderCode(db)).toBe("DH-0002");
  });

  it("never repeats a number, even under concurrent calls (no collisions)", async () => {
    const db = createTestDb();
    const codes = await Promise.all(Array.from({ length: 20 }, () => nextOrderCode(db)));
    expect(new Set(codes).size).toBe(20);
  });
});
