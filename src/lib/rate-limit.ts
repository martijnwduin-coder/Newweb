/**
 * Small sliding-window rate limiter keyed by client IP.
 * In-memory, so limits apply per server instance — enough to stop casual abuse of
 * paid APIs (Claude, Google Places). For multi-region scale, back it with Redis/Upstash.
 */
const buckets = new Map<string, number[]>();

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export function rateLimit(req: Request, name: string, limit: number, windowMs = 60_000) {
  const key = `${name}:${clientIp(req)}`;
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000);
    return { ok: false as const, retryAfter };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  return { ok: true as const };
}

export function tooMany(retryAfter: number) {
  return new Response(JSON.stringify({ error: "Too many requests — please slow down." }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) },
  });
}
