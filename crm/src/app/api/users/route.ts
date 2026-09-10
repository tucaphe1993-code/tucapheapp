import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { hashPassword } from "@/lib/auth/password";
import { requireRole } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, ConflictError, ValidationError } from "@/lib/api/errors";
import type { UserRow } from "@/types/db";

const createSchema = z.object({
  email: z.string().trim().email(),
  fullName: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
  role: z.enum(["ADMIN", "EMPLOYEE"]),
});

export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN");
    const db = getDb();
    const role = req.nextUrl.searchParams.get("role");
    const stmt = role
      ? db
          .prepare(
            `SELECT id, email, phone, full_name, role, status, created_at, updated_at FROM users WHERE role = ? ORDER BY created_at DESC`
          )
          .bind(role)
      : db.prepare(
          `SELECT id, email, phone, full_name, role, status, created_at, updated_at FROM users ORDER BY created_at DESC`
        );
    const { results } = await stmt.all();
    return NextResponse.json({ users: results });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole("ADMIN");
    const json = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    }
    const { email, fullName, phone, password, role } = parsed.data;

    const db = getDb();
    const existing = await db
      .prepare(`SELECT id FROM users WHERE email = ?`)
      .bind(email.toLowerCase())
      .first();
    if (existing) throw new ConflictError("Email đã được sử dụng");

    const { hash, salt } = await hashPassword(password);
    const id = newId();
    await db
      .prepare(
        `INSERT INTO users (id, email, phone, full_name, password_hash, password_salt, role, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`
      )
      .bind(id, email.toLowerCase(), phone || null, fullName, hash, salt, role)
      .run();

    await writeAuditLog({
      userId: session.user.id,
      action: "CREATE_USER",
      entity: "user",
      entityId: id,
      metadata: { role },
    });

    const user = await db
      .prepare(`SELECT id, email, phone, full_name, role, status, created_at, updated_at FROM users WHERE id = ?`)
      .bind(id)
      .first<Omit<UserRow, "password_hash" | "password_salt">>();
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
