import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, SESSION_COOKIE, cookieOptions } from "@/lib/server";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "invalid request" }, { status: 400 });
  }
  if (!body.email || !body.password || body.email.length > 320 || body.password.length > 200) {
    return NextResponse.json({ detail: "email and password are required" }, { status: 400 });
  }
  try {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": req.headers.get("x-forwarded-for") || "" },
      body: JSON.stringify({ email: body.email, password: body.password }),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ detail: data.detail || "login failed" }, { status: res.status });
    const out = NextResponse.json({ user: data.user });
    out.cookies.set(SESSION_COOKIE, data.token, cookieOptions);
    return out;
  } catch {
    return NextResponse.json({ detail: "backend unreachable" }, { status: 502 });
  }
}
