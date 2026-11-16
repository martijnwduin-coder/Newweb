import { describe, expect, it } from "vitest";
import { createDemoDatabase, DEMO_ME_ID } from "@/lib/demo/seed";
import { activityFeed, canView, friendIds, placeStats, relationship, reviewsForPlace, tasteProfile, visibleCollections, visibleReviews } from "@/lib/selectors";

const db = createDemoDatabase();

describe("social graph", () => {
  it("lists accepted friends only", () => {
    const ids = friendIds(db, DEMO_ME_ID);
    expect(ids).toContain("u-emma");
    expect(ids).not.toContain("u-mateo"); // pending request
  });

  it("classifies relationships", () => {
    expect(relationship(db, DEMO_ME_ID, DEMO_ME_ID)).toBe("self");
    expect(relationship(db, DEMO_ME_ID, "u-emma")).toBe("friends");
    expect(relationship(db, DEMO_ME_ID, "u-mateo")).toBe("pending_in");
    expect(relationship(db, DEMO_ME_ID, "u-daan")).toBe("pending_out");
    expect(relationship(db, DEMO_ME_ID, "u-freya")).toBe("none");
  });
});

describe("privacy", () => {
  it("mirrors the database can_view() rule", () => {
    expect(canView(db, "u-freya", DEMO_ME_ID, "public")).toBe(true);
    expect(canView(db, "u-emma", DEMO_ME_ID, "friends")).toBe(true);
    expect(canView(db, "u-freya", DEMO_ME_ID, "friends")).toBe(false);
    expect(canView(db, "u-emma", DEMO_ME_ID, "private")).toBe(false);
  });

  it("hides friends-only reviews from non-friends", () => {
    // Alex's reviews are friends-only.
    expect(visibleReviews(db, "u-emma").some((r) => r.userId === DEMO_ME_ID)).toBe(true);
    expect(visibleReviews(db, "u-freya").some((r) => r.userId === DEMO_ME_ID)).toBe(false);
  });

  it("hides private collections from everyone but the owner", () => {
    expect(visibleCollections(db, DEMO_ME_ID).some((c) => c.id === "c-alex-want")).toBe(true);
    expect(visibleCollections(db, "u-emma").some((c) => c.id === "c-alex-want")).toBe(false);
  });
});

describe("ratings", () => {
  it("separates community rating from friends' rating", () => {
    const s = placeStats(db, "p-lumen", DEMO_ME_ID);
    expect(s.count).toBe(3);
    expect(s.rating).toBeCloseTo((5 + 4.5 + 4.5) / 3);
    expect(s.recommenders.map((p) => p.id).sort()).toEqual(["u-emma", "u-sarah"]);
  });

  it("puts my own and friends' reviews first", () => {
    const rs = reviewsForPlace(db, "p-vlinder", DEMO_ME_ID);
    expect(rs[0].userId).toBe("u-noor"); // friend before Mateo (not connected)
  });
});

describe("activity and taste", () => {
  it("only shows activity from people I trust", () => {
    const trusted = new Set([...friendIds(db, DEMO_ME_ID), "u-ines"]);
    for (const e of activityFeed(db, DEMO_ME_ID)) if ("actor" in e) expect(trusted.has(e.actor.id)).toBe(true);
  });

  it("builds a taste profile from ratings", () => {
    const t = tasteProfile(db, DEMO_ME_ID);
    expect(t.reviewCount).toBe(5);
    expect(t.traits).toContain("Specialty coffee devotee");
  });
});
