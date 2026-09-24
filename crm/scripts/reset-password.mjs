// Đặt lại mật khẩu 1 tài khoản CRM (dùng khi quên mật khẩu admin — CRM
// không có "quên mật khẩu" qua email). Chạy trên máy đã `wrangler login`:
//
//   node scripts/reset-password.mjs          → đổi trên database THẬT (remote)
//   node scripts/reset-password.mjs --local  → đổi trên database thử ở máy
//
// Script hỏi email + mật khẩu mới (không nhận qua tham số dòng lệnh để mật
// khẩu không nằm trong lịch sử lệnh), băm PBKDF2 y hệt
// src/lib/auth/password.ts, ghi SQL ra file tạm, chạy `wrangler d1 execute`
// rồi xoá file tạm. Mọi phiên đăng nhập cũ của tài khoản đó bị đăng xuất,
// tài khoản bị khoá (DISABLED) được mở lại.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { webcrypto as crypto } from "node:crypto";

const DB_NAME = "tucaphe-crm-db";
// PHẢI khớp src/lib/auth/password.ts.
const ITERATIONS = 100_000;

function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, key, 256);
  return { hash: toHex(derived), salt: toHex(salt.buffer) };
}

const sqlStr = (v) => `'${String(v).replace(/'/g, "''")}'`;

function wrangler(args) {
  // shell: true để `npx` chạy được trên Windows (npx.cmd).
  return execFileSync("npx", ["wrangler", "d1", "execute", DB_NAME, ...args], {
    stdio: ["inherit", "pipe", "inherit"],
    encoding: "utf8",
    shell: process.platform === "win32",
  });
}

async function main() {
  const target = process.argv.includes("--local") ? "--local" : "--remote";
  // Đọc từng dòng qua async iterator — chạy đúng cả khi gõ tay lẫn khi dán/pipe.
  const rl = createInterface({ input: process.stdin, terminal: false });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (q) => {
    process.stdout.write(q);
    const { value } = await lines.next();
    return value ?? "";
  };

  console.log(`\nĐặt lại mật khẩu CRM — database: ${target === "--remote" ? "THẬT (remote)" : "thử (local)"}\n`);
  console.log("Các tài khoản hiện có:");
  const list = JSON.parse(
    wrangler([target, "--json", "--command", "SELECT email, full_name, role, status FROM users ORDER BY role, email"])
  );
  const users = list[0]?.results ?? [];
  for (const u of users) console.log(`  - ${u.email}  (${u.full_name}, ${u.role}${u.status !== "ACTIVE" ? ", " + u.status : ""})`);

  const email = (await ask("\nEmail cần đặt lại mật khẩu: ")).trim().toLowerCase();
  if (!users.some((u) => u.email.toLowerCase() === email)) {
    rl.close();
    throw new Error(`Không có tài khoản "${email}" trong danh sách trên.`);
  }
  const password = await ask("Mật khẩu mới (ít nhất 8 ký tự): ");
  const again = await ask("Nhập lại mật khẩu mới: ");
  rl.close();
  if (password.length < 8) throw new Error("Mật khẩu phải có ít nhất 8 ký tự.");
  if (password !== again) throw new Error("Hai lần nhập mật khẩu không khớp.");

  const { hash, salt } = await hashPassword(password);
  const sql = `
UPDATE users SET password_hash = ${sqlStr(hash)}, password_salt = ${sqlStr(salt)},
  status = 'ACTIVE', updated_at = datetime('now')
WHERE lower(email) = ${sqlStr(email)};
DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE lower(email) = ${sqlStr(email)});
`;
  const dir = mkdtempSync(join(tmpdir(), "tcp-reset-"));
  const file = join(dir, "reset.sql");
  try {
    writeFileSync(file, sql);
    wrangler([target, "--yes", "--file", file]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(`\n✅ Đã đặt lại mật khẩu cho ${email}. Đăng nhập lại bằng mật khẩu mới.\n`);
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}\n`);
  process.exit(1);
});
