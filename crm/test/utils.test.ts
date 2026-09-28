import { describe, it, expect } from "vitest";
import { numberToVietnameseWords } from "@/lib/utils";

describe("numberToVietnameseWords", () => {
  it("reads zero", () => {
    expect(numberToVietnameseWords(0)).toBe("Không đồng");
  });

  it("reads simple numbers under 1000", () => {
    expect(numberToVietnameseWords(5)).toBe("Năm đồng");
    expect(numberToVietnameseWords(15)).toBe("Mười lăm đồng");
    expect(numberToVietnameseWords(21)).toBe("Hai mươi mốt đồng");
    expect(numberToVietnameseWords(105)).toBe("Một trăm linh năm đồng");
    expect(numberToVietnameseWords(100)).toBe("Một trăm đồng");
  });

  it("reads thousands with a zero tens/hundreds gap", () => {
    expect(numberToVietnameseWords(5000)).toBe("Năm nghìn đồng");
    expect(numberToVietnameseWords(1_005_000)).toBe("Một triệu không trăm linh năm nghìn đồng");
  });

  it("reads a typical deposit amount", () => {
    expect(numberToVietnameseWords(10_000_000)).toBe("Mười triệu đồng");
    expect(numberToVietnameseWords(52_500_000)).toBe("Năm mươi hai triệu năm trăm nghìn đồng");
  });

  it("rounds fractional input and ignores sign", () => {
    expect(numberToVietnameseWords(1000.4)).toBe("Một nghìn đồng");
  });
});
