import { NextRequest, NextResponse } from "next/server";

const PUBLIC = ["/login", "/api/auth/login", "/api/auth/logout", "/favicon.ico"];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p)) || pathname.startsWith("/_next")) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.next(); // the proxy checks the cookie itself
  if (!req.cookies.get("ndt_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|svg|ico|jpg)$).*)"] };
