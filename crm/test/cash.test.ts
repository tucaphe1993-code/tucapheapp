import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb } from "./d1-shim";
import { recordCashVoucher } from "@/lib/services/cash";

let db: D1Database;
let userId: string;

beforeEach(async () => {
  db = createTestDb();
  userId = randomUUID();
  await db
    .prepare(`INSERT INTO users (id, email, full_name, password_hash, password_salt, role) VALUES (?, ?, ?, 'x', 'y', 'ADMIN')`)
    .bind(userId, "admin@test.local", "Admin Test")
    .run();
});

describe("recordCashVoucher", () => {
  it("tạo phiếu thu thành công và trả về đúng dòng vừa tạo", async () => {
    const voucher = await recordCashVoucher(
      { direction: "IN", category: "OTHER", amount: 500000, description: "Thu khác", createdBy: userId },
      db
    );
    expect(voucher).not.toBeNull();
    expect((voucher as { voucher_code: string }).voucher_code).toBe("PT-0001");
  });

  it("tự sinh mã PT/PC tăng dần theo từng hướng riêng biệt", async () => {
    const pt1 = await recordCashVoucher({ direction: "IN", category: "OTHER", amount: 1, createdBy: userId }, db);
    const pc1 = await recordCashVoucher({ direction: "OUT", category: "OTHER", amount: 1, createdBy: userId }, db);
    const pt2 = await recordCashVoucher({ direction: "IN", category: "OTHER", amount: 1, createdBy: userId }, db);
    expect((pt1 as { voucher_code: string }).voucher_code).toBe("PT-0001");
    expect((pc1 as { voucher_code: string }).voucher_code).toBe("PC-0001");
    expect((pt2 as { voucher_code: string }).voucher_code).toBe("PT-0002");
  });

  it("từ chối số tiền không dương", async () => {
    await expect(
      recordCashVoucher({ direction: "IN", category: "OTHER", amount: 0, createdBy: userId }, db)
    ).rejects.toThrow();
  });
});
