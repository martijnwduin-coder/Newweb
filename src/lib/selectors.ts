// Pure, framework-free read logic over a Database snapshot.
// The same functions power the UI, the recommendation engine and the AI assistant context.
import type { Category, Collection, Database, Place, Profile, Review, ReviewTag, Visibility } from "./types";
import { CATEGORY_META } from "./utils";

export type Relationship = "self" | "friends" | "pending_out" | "pending_in" | "none";

export function friendIds(db: Database, userId: string): string[] {
  const ids: string[] = [];
  for (const f of db.friendships) {
    if (f.status !== "accepted") continue;
    if (f.requesterId === userId) ids.push(f.addresseeId);
    else if (f.addresseeId === userId) ids.push(f.requesterId);
  }
  return ids;
}

export function followingIds(db: Database, userId: string) {
  return db.follows.filter((f) => f.followerId === userId).map((f) => f.followeeId);
}

export function followerIds(db: Database, userId: string) {
  return db.follows.filter((f) => f.followeeId === userId).map((f) => f.followerId);
}

/** People whose taste the user has opted into: friends + people they follow. */
export function trustedIds(db: Database, userId: string): Set<string> {
  return new Set([...friendIds(db, userId), ...followingIds(db, userId)]);
}

export function relationship(db: Database, me: string, other: string): Relationship {
  if (me === other) return "self";
  const f = db.friendships.find(
    (x) =>
      x.status !== "declined" &&
      ((x.requesterId === me && x.addresseeId === other) || (x.requesterId === other && x.addresseeId === me)),
  );
  if (!f) return "none";
  if (f.status === "accepted") return "friends";
  return f.requesterId === me ? "pending_out" : "pending_in";
}

export function isFollowing(db: Database, me: string, other: string) {
  return db.follows.some((f) => f.followerId === me && f.followeeId === other);
}

/** Mirrors the RLS helper `can_view(owner, visibility)` in the SQL migration. */
export function canView(db: Database, viewer: string, ownerId: string, visibility: Visibility) {
  if (viewer === ownerId) return true;
  if (visibility === "public") return true;
  if (visibility === "friends") return relationship(db, viewer, ownerId) === "friends";
  return false;
}

export function profileById(db: Database, id: string) {
  return db.profiles.find((p) => p.id === id);
}

export function placeById(db: Database, id: string) {
  return db.places.find((p) => p.id === id);
}

export function visibleReviews(db: Database, viewer: string): Review[] {
  const profiles = new Map(db.profiles.map((p) => [p.id, p]));
  return db.reviews.filter((r) => {
    const owner = profiles.get(r.userId);
    return owner ? canView(db, viewer, owner.id, owner.privacy.reviews) : false;
  });
}

export function reviewsForPlace(db: Database, placeId: string, viewer: string) {
  const trusted = trustedIds(db, viewer);
  const friends = new Set(friendIds(db, viewer));
  return visibleReviews(db, viewer)
    .filter((r) => r.placeId === placeId)
    .sort((a, b) => {
      const rank = (r: Review) => (r.userId === viewer ? 0 : friends.has(r.userId) ? 1 : trusted.has(r.userId) ? 2 : 3);
      return rank(a) - rank(b) || +new Date(b.createdAt) - +new Date(a.createdAt);
    });
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export interface PlaceStats {
  rating: number | null;
  count: number;
  friendRating: number | null;
  friendCount: number;
  /** Friends / followed people who rated it ≥ 4 */
  recommenders: Profile[];
  savedByFriends: Profile[];
  breakdown: { food: number | null; drinks: number | null; atmosphere: number | null; service: number | null; value: number | null };
  topItems: { item: string; count: number }[];
  topTags: { tag: ReviewTag; count: number }[];
}

export function placeStats(db: Database, placeId: string, viewer: string): PlaceStats {
  const rs = visibleReviews(db, viewer).filter((r) => r.placeId === placeId);
  const trusted = trustedIds(db, viewer);
  const friendRs = rs.filter((r) => trusted.has(r.userId));
  const nums = (k: keyof Review) => rs.map((r) => r[k]).filter((v): v is number => typeof v === "number");
  const items = new Map<string, number>();
  const tags = new Map<ReviewTag, number>();
  for (const r of rs) {
    for (const i of r.recommendedItems) items.set(i, (items.get(i) ?? 0) + 1);
    for (const t of r.tags) tags.set(t, (tags.get(t) ?? 0) + 1);
  }
  const savedBy = new Set(friendIds(db, viewer));
  return {
    rating: avg(rs.map((r) => r.overall)),
    count: rs.length,
    friendRating: avg(friendRs.map((r) => r.overall)),
    friendCount: friendRs.length,
    recommenders: friendRs
      .filter((r) => r.overall >= 4)
      .map((r) => profileById(db, r.userId))
      .filter((p): p is Profile => Boolean(p)),
    savedByFriends: db.saved
      .filter((s) => s.placeId === placeId && savedBy.has(s.userId))
      .map((s) => profileById(db, s.userId))
      .filter((p): p is Profile => Boolean(p) && canView(db, viewer, p!.id, p!.privacy.saved)),
    breakdown: {
      food: avg(nums("food")),
      drinks: avg(nums("drinks")),
      atmosphere: avg(nums("atmosphere")),
      service: avg(nums("service")),
      value: avg(nums("value")),
    },
    topItems: [...items.entries()].map(([item, count]) => ({ item, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    topTags: [...tags.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 6),
  };
}

export function isSaved(db: Database, userId: string, placeId: string) {
  return db.saved.some((s) => s.userId === userId && s.placeId === placeId);
}

export function myReview(db: Database, userId: string, placeId: string) {
  return db.reviews.find((r) => r.userId === userId && r.placeId === placeId);
}

export interface FriendPick {
  place: Place;
  review: Review;
  by: Profile;
}

/** "Recommended by your friends": the latest ≥4★ review per place from trusted people. */
export function friendPicks(db: Database, me: string, limit = 12): FriendPick[] {
  const trusted = trustedIds(db, me);
  const seen = new Set<string>();
  const out: FriendPick[] = [];
  const rs = visibleReviews(db, me)
    .filter((r) => trusted.has(r.userId) && r.overall >= 4)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  for (const r of rs) {
    if (seen.has(r.placeId)) continue;
    const place = placeById(db, r.placeId);
    const by = profileById(db, r.userId);
    if (!place || !by) continue;
    seen.add(r.placeId);
    out.push({ place, review: r, by });
    if (out.length >= limit) break;
  }
  return out;
}

/** "Popular in your community": friends, follows and friends-of-friends, Bayesian-weighted. */
export function communityFavourites(db: Database, me: string, limit = 10) {
  const first = trustedIds(db, me);
  const network = new Set(first);
  for (const id of first) for (const f of friendIds(db, id)) if (f !== me) network.add(f);
  const byPlace = new Map<string, number[]>();
  for (const r of visibleReviews(db, me)) {
    if (!network.has(r.userId)) continue;
    byPlace.set(r.placeId, [...(byPlace.get(r.placeId) ?? []), r.overall]);
  }
  const prior = 3.8;
  const k = 2;
  return [...byPlace.entries()]
    .map(([placeId, xs]) => ({
      place: placeById(db, placeId)!,
      score: (prior * k + xs.reduce((a, b) => a + b, 0)) / (k + xs.length),
      rating: avg(xs)!,
      count: xs.length,
    }))
    .filter((x) => x.place)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export type ActivityEvent =
  | { kind: "review"; id: string; at: string; actor: Profile; place: Place; review: Review }
  | { kind: "save"; id: string; at: string; actor: Profile; place: Place }
  | { kind: "collection"; id: string; at: string; actor: Profile; collection: Collection; count: number }
  | { kind: "city_saves"; id: string; at: string; city: string; count: number; actors: Profile[] };

export function activityFeed(db: Database, me: string, opts: { limit?: number; onlyUser?: string } = {}): ActivityEvent[] {
  const trusted = opts.onlyUser ? new Set([opts.onlyUser]) : trustedIds(db, me);
  const events: ActivityEvent[] = [];
  for (const r of visibleReviews(db, me)) {
    if (!trusted.has(r.userId)) continue;
    const actor = profileById(db, r.userId);
    const place = placeById(db, r.placeId);
    if (actor && place) events.push({ kind: "review", id: `ev-${r.id}`, at: r.updatedAt, actor, place, review: r });
  }
  const savesByCity = new Map<string, { count: number; actors: Map<string, Profile>; latest: string }>();
  for (const s of db.saved) {
    if (!trusted.has(s.userId)) continue;
    const actor = profileById(db, s.userId);
    const place = placeById(db, s.placeId);
    if (!actor || !place || !canView(db, me, actor.id, actor.privacy.saved)) continue;
    events.push({ kind: "save", id: `ev-${s.id}`, at: s.createdAt, actor, place });
    const entry = savesByCity.get(place.city) ?? { count: 0, actors: new Map(), latest: s.createdAt };
    entry.count += 1;
    entry.actors.set(actor.id, actor);
    if (s.createdAt > entry.latest) entry.latest = s.createdAt;
    savesByCity.set(place.city, entry);
  }
  for (const c of db.collections) {
    if (!trusted.has(c.userId) || !canView(db, me, c.userId, c.visibility)) continue;
    const actor = profileById(db, c.userId);
    if (actor)
      events.push({
        kind: "collection",
        id: `ev-${c.id}`,
        at: c.createdAt,
        actor,
        collection: c,
        count: db.collectionPlaces.filter((cp) => cp.collectionId === c.id).length,
      });
  }
  if (!opts.onlyUser) {
    for (const [city, e] of savesByCity) {
      if (e.count >= 3)
        events.push({ kind: "city_saves", id: `ev-city-${city}`, at: e.latest, city, count: e.count, actors: [...e.actors.values()] });
    }
  }
  return events.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, opts.limit ?? 60);
}

export interface TasteProfile {
  title: string;
  traits: string[];
  topCategories: { category: Category; count: number }[];
  topTags: { tag: ReviewTag; count: number }[];
  averageGiven: number | null;
  reviewCount: number;
  cities: string[];
  pricePreference: number | null;
  progress: number; // 0–1, how "developed" the profile is
}

export function tasteProfile(db: Database, userId: string): TasteProfile {
  const rs = db.reviews.filter((r) => r.userId === userId);
  const savedPlaces = db.saved.filter((s) => s.userId === userId).map((s) => placeById(db, s.placeId)).filter(Boolean) as Place[];
  const cats = new Map<Category, number>();
  const tags = new Map<ReviewTag, number>();
  const cities = new Map<string, number>();
  const prices: number[] = [];
  for (const r of rs) {
    const p = placeById(db, r.placeId);
    if (!p) continue;
    const weight = r.overall >= 4 ? 2 : 1;
    cats.set(p.category, (cats.get(p.category) ?? 0) + weight);
    cities.set(p.city, (cities.get(p.city) ?? 0) + 1);
    if (p.priceLevel) prices.push(p.priceLevel);
    for (const t of r.tags) tags.set(t, (tags.get(t) ?? 0) + 1);
  }
  for (const p of savedPlaces) cats.set(p.category, (cats.get(p.category) ?? 0) + 1);
  const topCategories = [...cats.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
  const topTags = [...tags.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
  const averageGiven = avg(rs.map((r) => r.overall));
  const pricePreference = avg(prices);

  const traits: string[] = [];
  const lead = topCategories[0]?.category;
  if (topTags.some((t) => t.tag === "great coffee")) traits.push("Specialty coffee devotee");
  if (topTags.some((t) => t.tag === "hidden gem")) traits.push("Hidden-gem hunter");
  if (topTags.some((t) => t.tag === "date night")) traits.push("Date-night planner");
  if (topTags.some((t) => t.tag === "brunch")) traits.push("Weekend bruncher");
  if (topTags.some((t) => t.tag === "natural wine")) traits.push("Natural wine curious");
  if (pricePreference && pricePreference <= 1.8) traits.push("Value seeker");
  if (pricePreference && pricePreference >= 3) traits.push("Special-occasion diner");
  if (averageGiven && averageGiven < 4) traits.push("Tough critic");
  if (cities.size >= 2) traits.push("Travels to eat");

  const leadLabel = lead ? CATEGORY_META[lead].plural.toLowerCase() : null;
  const title =
    rs.length < 3
      ? "Taste profile in progress"
      : lead === "coffee"
        ? "The Coffee Cartographer"
        : lead === "bakery"
          ? "The Early Riser"
          : lead === "bar"
            ? "The Night Owl"
            : lead === "cafe"
              ? "The Slow-Morning Regular"
              : `The ${leadLabel ? leadLabel[0].toUpperCase() + leadLabel.slice(1, -1) : "Restaurant"} Regular`;

  return {
    title,
    traits: traits.slice(0, 4),
    topCategories,
    topTags: topTags.slice(0, 5),
    averageGiven,
    reviewCount: rs.length,
    cities: [...cities.keys()],
    pricePreference,
    progress: Math.min(1, rs.length / 15),
  };
}

export function collectionPlaceIds(db: Database, collectionId: string) {
  return db.collectionPlaces
    .filter((cp) => cp.collectionId === collectionId)
    .sort((a, b) => a.position - b.position)
    .map((cp) => cp.placeId);
}

export function visibleCollections(db: Database, viewer: string, ownerId?: string) {
  return db.collections.filter(
    (c) => (!ownerId || c.userId === ownerId) && canView(db, viewer, c.userId, c.visibility),
  );
}

export function collectionCover(db: Database, c: Collection) {
  if (c.coverImage) return c.coverImage;
  const first = collectionPlaceIds(db, c.id)[0];
  return first ? placeById(db, first)?.imageUrl ?? null : null;
}

export function isFollowingCollection(db: Database, userId: string, collectionId: string) {
  return db.collectionFollows.some((f) => f.userId === userId && f.collectionId === collectionId);
}

export function cities(db: Database) {
  return [...new Set(db.places.map((p) => p.city))].sort();
}
