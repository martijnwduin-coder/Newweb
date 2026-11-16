import { rateLimit, tooMany } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

/** Proxies Google Places photos so the API key stays server-side. */
export async function GET(req: Request) {
  const limited = rateLimit(req, "places-photo", 150);
  if (!limited.ok) return tooMany(limited.retryAfter);
  const name = new URL(req.url).searchParams.get("name");
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!name || !key || !/^places\/[\w-]+\/photos\/[\w-]+$/.test(name)) return new NextResponse(null, { status: 404 });
  const res = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=1200&key=${key}`, { next: { revalidate: 86400 } });
  if (!res.ok || !res.body) return new NextResponse(null, { status: 404 });
  return new NextResponse(res.body, {
    headers: { "Content-Type": res.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "public, max-age=86400" },
  });
}
