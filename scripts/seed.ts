/**
 * Seeds a Supabase project with the fictional demo dataset.
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run db:seed
 * Creates one auth user per demo person (password: DEMO_PASSWORD, default "peloton-demo")
 * and inserts places, reviews, friendships, follows, collections, saves and recommendations.
 * Safe to re-run: existing demo users are reused and rows are upserted.
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createDemoDatabase } from "../src/lib/demo/seed";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_PASSWORD ?? "peloton-demo";
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const db = createDemoDatabase();

// Stable mapping from demo ids ("u-emma", "p-fiume") to UUIDs.
const ids = new Map<string, string>();
const id = (demoId: string) => {
  if (!ids.has(demoId)) ids.set(demoId, randomUUID());
  return ids.get(demoId)!;
};

async function must<T>(p: PromiseLike<{ data: T; error: unknown }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
  return data;
}

async function main() {
  // 1. Users (auth + profile)
  const listed = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (listed.error) throw new Error(`list users: ${listed.error.message}`);
  const existing = listed.data;
  for (const p of db.profiles) {
    const email = `${p.username}@peloton.demo`;
    let user = existing.users.find((u) => u.email === email);
    if (!user) {
      const created = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: p.fullName, username: p.username } });
      if (created.error) throw new Error(`create ${email}: ${created.error.message}`);
      user = created.data.user;
    }
    ids.set(p.id, user.id);
    await must(
      sb.from("profiles").update({
        username: p.username,
        full_name: p.fullName,
        bio: p.bio,
        location: p.location,
        profile_visibility: p.privacy.profile,
        saved_visibility: p.privacy.saved,
        reviews_visibility: p.privacy.reviews,
        created_at: p.createdAt,
      }).eq("id", user.id),
      `profile ${p.username}`,
    );
  }

  // 2. Places (match on name+city so re-runs don't duplicate)
  const knownPlaces = await must(sb.from("places").select("id, name, city"), "places");
  for (const p of db.places) {
    const found = (knownPlaces ?? []).find((k: { name: string; city: string }) => k.name === p.name && k.city === p.city);
    if (found) ids.set(p.id, found.id);
  }
  await must(
    sb.from("places").upsert(
      db.places.map((p) => ({
        id: id(p.id),
        name: p.name,
        address: p.address,
        city: p.city,
        neighborhood: p.neighborhood,
        latitude: p.lat,
        longitude: p.lng,
        category: p.category,
        cuisine: p.cuisine,
        image_url: p.imageUrl,
        opening_hours: p.openingHours,
        price_level: p.priceLevel,
        description: p.description,
        created_at: p.createdAt,
      })),
    ),
    "upsert places",
  );

  // 3. Reviews — unique per (user, place)
  await must(
    sb.from("reviews").upsert(
      db.reviews.map((r) => ({
        user_id: id(r.userId),
        place_id: id(r.placeId),
        overall_rating: r.overall,
        food_rating: r.food,
        drinks_rating: r.drinks,
        atmosphere_rating: r.atmosphere,
        service_rating: r.service,
        value_rating: r.value,
        review_text: r.text,
        visited_on: r.visitedOn,
        price_level: r.priceLevel,
        recommended_items: r.recommendedItems,
        tags: r.tags,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      })),
      { onConflict: "user_id,place_id" },
    ),
    "upsert reviews",
  );

  // 4. Social graph — wipe demo users' edges, then insert fresh
  const userIds = db.profiles.map((p) => id(p.id));
  await must(sb.from("friendships").delete().in("requester_id", userIds), "clear friendships");
  await must(sb.from("follows").delete().in("follower_id", userIds), "clear follows");
  await must(sb.from("notifications").delete().in("user_id", userIds), "clear notifications");
  await must(
    sb.from("friendships").insert(db.friendships.map((f) => ({ requester_id: id(f.requesterId), addressee_id: id(f.addresseeId), status: f.status, created_at: f.createdAt }))),
    "friendships",
  );
  await must(sb.from("follows").insert(db.follows.map((f) => ({ follower_id: id(f.followerId), followee_id: id(f.followeeId), created_at: f.createdAt }))), "follows");

  // 5. Collections
  await must(sb.from("collections").delete().in("user_id", userIds), "clear collections");
  await must(
    sb.from("collections").insert(
      db.collections.map((c) => ({ id: id(c.id), user_id: id(c.userId), title: c.title, description: c.description, cover_image: c.coverImage, visibility: c.visibility, created_at: c.createdAt })),
    ),
    "collections",
  );
  await must(
    sb.from("collection_places").insert(db.collectionPlaces.map((cp) => ({ collection_id: id(cp.collectionId), place_id: id(cp.placeId), position: cp.position }))),
    "collection places",
  );
  await must(sb.from("collection_follows").insert(db.collectionFollows.map((f) => ({ user_id: id(f.userId), collection_id: id(f.collectionId), created_at: f.createdAt }))), "collection follows");

  // 6. Saves and recommendations
  await must(sb.from("saved_places").delete().in("user_id", userIds), "clear saves");
  await must(sb.from("saved_places").insert(db.saved.map((s) => ({ user_id: id(s.userId), place_id: id(s.placeId), created_at: s.createdAt }))), "saves");
  await must(sb.from("place_recommendations").delete().in("sender_id", userIds), "clear recs");
  await must(
    sb.from("place_recommendations").insert(
      db.recommendations.map((r) => ({ sender_id: id(r.senderId), receiver_id: id(r.receiverId), place_id: r.placeId ? id(r.placeId) : null, message: r.message, created_at: r.createdAt })),
    ),
    "recommendations",
  );

  console.log(`Seeded ${db.profiles.length} users, ${db.places.length} places, ${db.reviews.length} reviews, ${db.collections.length} collections.`);
  console.log(`Sign in as alex@peloton.demo / ${password} (any demo user works: emma@, thomas@, sarah@ …)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
