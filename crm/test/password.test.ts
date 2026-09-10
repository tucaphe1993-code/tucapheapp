import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("verifies the correct password", async () => {
    const { hash, salt } = await hashPassword("Correct-Horse-Battery-1");
    expect(await verifyPassword("Correct-Horse-Battery-1", salt, hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const { hash, salt } = await hashPassword("Correct-Horse-Battery-1");
    expect(await verifyPassword("wrong-password", salt, hash)).toBe(false);
  });

  it("never stores the password in plain text (hash differs from input)", async () => {
    const { hash } = await hashPassword("Correct-Horse-Battery-1");
    expect(hash).not.toBe("Correct-Horse-Battery-1");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("uses a random salt so two hashes of the same password differ", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});
