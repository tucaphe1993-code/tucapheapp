import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError, ValidationError } from "@/lib/api/errors";
import type { UserRow } from "@/types/db";

const bodySchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

// Very small in-memory rate limit per Worker isolate: not a substitute for
// Cloudflare-level rate limiting (see DEPLOY.md), but blocks trivial
// same-isolate brute force without any extra infra.
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

function checkRateLimit(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Quá nhiều lần thử. Vui lòng thử lại sau." },
        { status: 429 }
      );
    }

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError("Email và mật khẩu không hợp lệ");
    }
    const { email, password } = parsed.data;

    const db = getDb();
    const user = await db
      .prepare(`SELECT * FROM users WHERE email = ? AND status = 'ACTIVE'`)
      .bind(email.toLowerCase())
      .first<UserRow>();

    if (!user) {
      throw new ValidationError("Sai email hoặc mật khẩu");
    }

    const ok = await verifyPassword(password, user.password_salt, user.password_hash);
    if (!ok) {
      throw new ValidationError("Sai email hoặc mật khẩu");
    }

    const token = await createSession(user.id);
    await writeAuditLog({
      userId: user.id,
      action: "LOGIN",
      entity: "user",
      entityId: user.id,
    });

    const res = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
    });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
