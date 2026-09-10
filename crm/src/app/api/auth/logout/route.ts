import { NextRequest, NextResponse } from "next/server";
import { destroySessionByToken, getSession, SESSION_COOKIE } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { handleApiError } from "@/lib/api/errors";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (token) {
      await destroySessionByToken(token);
    }
    if (session) {
      await writeAuditLog({
        userId: session.user.id,
        action: "LOGOUT",
        entity: "user",
        entityId: session.user.id,
      });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(SESSION_COOKIE);
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
