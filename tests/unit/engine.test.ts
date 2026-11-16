import { describe, expect, it } from "vitest";
import { parseIntent, recommend, templateAnswer } from "@/lib/ai/engine";
import { createDemoDatabase, DEMO_ME_ID } from "@/lib/demo/seed";

const db = createDemoDatabase();
const names = (q: string, opts = {}) => {
  const { intent, candidates } = recommend(db, DEMO_ME_ID, q, opts);
  return candidates.slice(0, intent.count).map((c) => c.place.name);
};

describe("parseIntent", () => {
  it("reads city, cuisine and friend filter", () => {
    const i = parseIntent("Find me a great Italian restaurant in Amsterdam recommended by my friends.", db);
    expect(i.city).toBe("Amsterdam");
    expect(i.cuisines).toEqual(["italian"]);
    expect(i.categories).toContain("restaurant");
    expect(i.friendsOnly).toBe(true);
  });

  it("reads counts written as words", () => {
    expect(parseIntent("Give me five great date-night restaurants.", db).count).toBe(5);
    expect(parseIntent("three bakeries", db).count).toBe(3);
  });

  it("detects 'friends have saved' separately from 'I saved'", () => {
    const i = parseIntent("What are the best places my friends have saved in Copenhagen?", db);
    expect(i.friendsSaved).toBe(true);
    expect(i.savedOnly).toBe(false);
  });
});

describe("recommend", () => {
  it("only returns Italian places in Amsterdam recommended by friends", () => {
    expect(names("Find me a great Italian restaurant in Amsterdam recommended by my friends.")).toEqual(["Osteria Fiume", "Verde Pasta Bar"]);
  });

  it("requires a friend's save for 'friends have saved' and ranks it first", () => {
    const { candidates, relaxed } = recommend(db, DEMO_ME_ID, "What are the best places my friends have saved in Copenhagen?");
    expect(relaxed).toBeUndefined();
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(c.place.city).toBe("Copenhagen");
      expect(c.facts[0]).toMatch(/^Saved by /);
    }
  });

  it("keeps date-night answers to restaurants and bars", () => {
    const { candidates } = recommend(db, DEMO_ME_ID, "Date night in Amsterdam my friends loved");
    expect(candidates.every((c) => ["restaurant", "bar"].includes(c.place.category))).toBe(true);
  });

  it("uses distance when asked for places near me", () => {
    const { candidates } = recommend(db, DEMO_ME_ID, "coffee near me", { location: { lat: 52.3702, lng: 4.8952 } });
    expect(candidates.every((c) => c.distanceKm != null && c.distanceKm < 15)).toBe(true);
    expect(candidates[0].facts.some((f) => / from you$/.test(f))).toBe(true);
  });

  it("never invents data: every fact is traceable to the database", () => {
    const { candidates } = recommend(db, DEMO_ME_ID, "Give me five great date-night restaurants.");
    for (const c of candidates) {
      for (const f of c.facts) {
        const m = f.match(/^(\w+) \((friend|you follow)\) rated it ([\d.]+)★/);
        if (!m) continue;
        const user = db.profiles.find((p) => p.fullName.startsWith(m[1]))!;
        const review = db.reviews.find((r) => r.userId === user.id && r.placeId === c.place.id)!;
        expect(review.overall.toFixed(1)).toBe(m[3]);
      }
    }
  });

  it("returns nothing (not made-up places) when nothing matches", () => {
    const { intent, candidates } = recommend(db, DEMO_ME_ID, "Cheap sushi in Lisbon");
    expect(candidates).toHaveLength(0);
    expect(templateAnswer(intent, [])).toMatch(/couldn't find/);
  });
});

describe("templateAnswer", () => {
  it("uses correct singular grammar", () => {
    const { intent, candidates } = recommend(db, DEMO_ME_ID, "A hidden-gem bakery in Paris");
    expect(templateAnswer(intent, candidates.slice(0, 1))).toMatch(/^Here's one bakery in Paris/);
  });
});
