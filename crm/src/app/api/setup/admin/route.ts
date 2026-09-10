import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, getEnv } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { newId } from "@/lib/db/id";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, ValidationError } from "@/lib/api/errors";

/**
 * One-time bootstrap: creates the FIRST admin account.
 * Requires the `ADMIN_SETUP_TOKEN` Cloudflare secret (see .env.example /
 * DEPLOY.md) as a bearer token, and refuses once any ADMIN already exists —
 * so it cannot be used to mint extra admins later, and no password is ever
 * hard-coded in source.
 */
const bodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
  fullName: z.string().trim().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const env = getEnv();
    if (!env.ADMIN_SETUP_TOKEN) {
      return NextResponse.json(
        { error: "ADMIN_SETUP_TOKEN chưa được cấu hình trên server" },
        { status: 503 }
      );
    }

    const authHeader = req.headers.get("authorization");
    const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!bearer || bearer !== env.ADMIN_SETUP_TOKEN) {
      return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
    }

    const db = getDb();
    const existingAdmin = await db
      .prepare(`SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1`)
      .first();
    if (existingAdmin) {
      return NextResponse.json(
        { error: "Đã tồn tại tài khoản ADMIN. Không thể khởi tạo lại." },
        { status: 409 }
      );
    }

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }
    const { email, password, fullName } = parsed.data;

    const { hash, salt } = await hashPassword(password);
    const id = newId();
    await db
      .prepare(
        `INSERT INTO users (id, email, full_name, password_hash, password_salt, role, status)
         VALUES (?, ?, ?, ?, ?, 'ADMIN', 'ACTIVE')`
      )
      .bind(id, email.toLowerCase(), fullName, hash, salt)
      .run();

    await writeAuditLog({
      userId: id,
      action: "CREATE_USER",
      entity: "user",
      entityId: id,
      metadata: { role: "ADMIN", bootstrap: true },
    });

    return NextResponse.json({ ok: true, userId: id });
  } catch (err) {
    return handleApiError(err);
  }
}
