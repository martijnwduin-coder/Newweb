import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

const req = (ip: string) => new Request("http://x/api", { headers: { "x-forwarded-for": ip } });

describe("rateLimit", () => {
  it("allows up to the limit, then blocks with a retry time", () => {
    for (let i = 0; i < 3; i++) expect(rateLimit(req("1.1.1.1"), "t", 3).ok).toBe(true);
    const r = rateLimit(req("1.1.1.1"), "t", 3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryAfter).toBeGreaterThan(0);
  });

  it("tracks clients separately", () => {
    for (let i = 0; i < 3; i++) rateLimit(req("2.2.2.2"), "u", 3);
    expect(rateLimit(req("3.3.3.3"), "u", 3).ok).toBe(true);
  });
});
