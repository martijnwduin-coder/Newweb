import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, SESSION_COOKIE } from "@/lib/server";

export const dynamic = "force-dynamic";

const ALLOWED = /^(api\/|auth\/me$|health)/;

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = path.join("/");
  if (!ALLOWED.test(target) || target.includes("..")) {
    return NextResponse.json({ detail: "not found" }, { status: 404 });
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ detail: "not authenticated" }, { status: 401 });
  const url = `${BACKEND_URL}/${target}${req.nextUrl.search}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": req.headers.get("content-type") || "application/json",
    "X-Forwarded-For": req.headers.get("x-forwarded-for") || "",
  };
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : await req.text();
  try {
    const res = await fetch(url, { method: req.method, headers, body, cache: "no-store" });
    const out = new NextResponse(res.status === 204 ? null : await res.arrayBuffer(), { status: res.status });
    const ct = res.headers.get("content-type");
    if (ct) out.headers.set("content-type", ct);
    if (res.status === 401) out.cookies.delete(SESSION_COOKIE);
    return out;
  } catch {
    return NextResponse.json({ detail: "backend unreachable" }, { status: 502 });
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
