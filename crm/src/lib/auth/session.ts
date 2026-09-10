import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import { generateToken, sha256Hex } from "@/lib/auth/password";
import { newId } from "@/lib/db/id";
import type { SafeUser, UserRow } from "@/types/db";

export const SESSION_COOKIE = "tcp_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export async function createSession(userId: string): Promise<string> {
  const db = getDb();
  const token = generateToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`
    )
    .bind(newId(), userId, tokenHash, expiresAt)
    .run();

  return token;
}

export async function destroySessionByToken(token: string): Promise<void> {
  const db = getDb();
  const tokenHash = await sha256Hex(token);
  await db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).bind(tokenHash).run();
}

export interface AuthedSession {
  user: SafeUser;
}

function toSafeUser(row: UserRow): SafeUser {
  const { password_hash: _ph, password_salt: _ps, ...safe } = row;
  return safe;
}

/**
 * Server-side source of truth for "who is logged in". Always re-checks the
 * session + user against D1 (never trusts the cookie value alone) so a
 * disabled user or expired/revoked session is rejected immediately.
 */
export async function getSession(): Promise<AuthedSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  const tokenHash = await sha256Hex(token);

  const session = await db
    .prepare(`SELECT * FROM sessions WHERE token_hash = ?`)
    .bind(tokenHash)
    .first<{ id: string; user_id: string; expires_at: string }>();

  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(session.id).run();
    return null;
  }

  const user = await db
    .prepare(`SELECT * FROM users WHERE id = ?`)
    .bind(session.user_id)
    .first<UserRow>();

  if (!user || user.status !== "ACTIVE") return null;

  return { user: toSafeUser(user) };
}

export async function requireSession(): Promise<AuthedSession> {
  const session = await getSession();
  if (!session) {
    throw new UnauthorizedError();
  }
  return session;
}

export async function requireRole(...roles: Array<"ADMIN" | "EMPLOYEE">) {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) {
    throw new ForbiddenError();
  }
  return session;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}
