import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

// Coarse gate only: presence of a session cookie. Actual identity, role,
// and expiry are re-checked against D1 in every server component / API
// route via getSession()/requireRole() — this proxy never decides
// authorization on its own, only whether to bounce anonymous traffic away
// from app pages before any render work happens.
const PUBLIC_PATHS = ["/login"];
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/setup/"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const hasSession = req.cookies.has(SESSION_COOKIE);

  if (pathname.startsWith("/api/")) {
    if (!hasSession) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/).*)"],
};
