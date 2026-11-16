"use client";
import { getSupabaseBrowser } from "../supabase/client";
import type {
  AppNotification,
  Collection,
  CollectionFollow,
  CollectionPlace,
  Database,
  Follow,
  Friendship,
  Place,
  PlaceRecommendation,
  Profile,
  Review,
  SavedPlace,
} from "../types";
import type { Backend } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

// ── row <-> domain mapping ───────────────────────────────────────────────
const toProfile = (r: Row): Profile => ({
  id: r.id,
  username: r.username,
  fullName: r.full_name || r.username,
  avatarUrl: r.avatar_url,
  bio: r.bio,
  location: r.location,
  createdAt: r.created_at,
  privacy: { profile: r.profile_visibility, saved: r.saved_visibility, reviews: r.reviews_visibility },
});
const fromProfile = (p: Profile) => ({
  username: p.username,
  full_name: p.fullName,
  avatar_url: p.avatarUrl,
  bio: p.bio,
  location: p.location,
  profile_visibility: p.privacy.profile,
  saved_visibility: p.privacy.saved,
  reviews_visibility: p.privacy.reviews,
});

const toPlace = (r: Row): Place => ({
  id: r.id,
  googlePlaceId: r.google_place_id,
  name: r.name,
  address: r.address,
  city: r.city,
  neighborhood: r.neighborhood,
  lat: r.latitude,
  lng: r.longitude,
  category: r.category,
  cuisine: r.cuisine,
  imageUrl: r.image_url,
  website: r.website,
  phone: r.phone,
  openingHours: r.opening_hours,
  priceLevel: r.price_level,
  description: r.description,
  createdAt: r.created_at,
  source: r.google_place_id ? "google" : "user",
  googleRating: r.google_rating != null ? Number(r.google_rating) : null,
  googleRatingCount: r.google_rating_count,
});
const fromPlace = (p: Place, me: string) => ({
  id: p.id,
  google_place_id: p.googlePlaceId,
  name: p.name,
  address: p.address,
  city: p.city,
  neighborhood: p.neighborhood,
  latitude: p.lat,
  longitude: p.lng,
  category: p.category,
  cuisine: p.cuisine,
  image_url: p.imageUrl,
  website: p.website,
  phone: p.phone,
  opening_hours: p.openingHours,
  price_level: p.priceLevel,
  description: p.description,
  google_rating: p.googleRating,
  google_rating_count: p.googleRatingCount,
  created_by: me,
});

const num = (v: any) => (v == null ? null : Number(v));
const toReview = (r: Row): Review => ({
  id: r.id,
  userId: r.user_id,
  placeId: r.place_id,
  overall: Number(r.overall_rating),
  food: num(r.food_rating),
  drinks: num(r.drinks_rating),
  atmosphere: num(r.atmosphere_rating),
  service: num(r.service_rating),
  value: num(r.value_rating),
  text: r.review_text,
  photos: (r.review_photos ?? []).map((p: Row) => p.image_url),
  visitedOn: r.visited_on,
  priceLevel: r.price_level,
  recommendedItems: r.recommended_items ?? [],
  tags: r.tags ?? [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toCollection = (r: Row): Collection => ({
  id: r.id,
  userId: r.user_id,
  title: r.title,
  description: r.description,
  coverImage: r.cover_image,
  visibility: r.visibility,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

function must(res: { data: unknown; error: { message: string } | null }): any {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

let meCache: string | null = null;

export const supabaseBackend: Backend = {
  mode: "live",
  async load() {
    const sb = getSupabaseBrowser();
    const {
      data: { user },
    } = await sb.auth.getUser();
    meCache = user?.id ?? null;

    const [profiles, places, reviews, friendships, follows, collections, cps, cfs, saved, recs, notes] = await Promise.all([
      sb.from("profiles").select("*").limit(2000),
      sb.from("places").select("*").limit(5000),
      sb.from("reviews").select("*, review_photos(image_url)").limit(10000),
      sb.from("friendships").select("*"),
      sb.from("follows").select("*"),
      sb.from("collections").select("*"),
      sb.from("collection_places").select("*"),
      sb.from("collection_follows").select("*"),
      sb.from("saved_places").select("*"),
      sb.from("place_recommendations").select("*").order("created_at", { ascending: false }),
      sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(100),
    ]);

    const db: Database = {
      profiles: must(profiles).map(toProfile),
      places: must(places).map(toPlace),
      reviews: must(reviews).map(toReview),
      friendships: must(friendships).map(
        (r: Row): Friendship => ({ id: r.id, requesterId: r.requester_id, addresseeId: r.addressee_id, status: r.status, createdAt: r.created_at }),
      ),
      follows: must(follows).map((r: Row): Follow => ({ id: r.id, followerId: r.follower_id, followeeId: r.followee_id, createdAt: r.created_at })),
      collections: must(collections).map(toCollection),
      collectionPlaces: must(cps).map(
        (r: Row): CollectionPlace => ({ id: r.id, collectionId: r.collection_id, placeId: r.place_id, position: r.position }),
      ),
      collectionFollows: must(cfs).map(
        (r: Row): CollectionFollow => ({ id: r.id, userId: r.user_id, collectionId: r.collection_id, createdAt: r.created_at }),
      ),
      saved: must(saved).map((r: Row): SavedPlace => ({ id: r.id, userId: r.user_id, placeId: r.place_id, createdAt: r.created_at })),
      recommendations: must(recs).map(
        (r: Row): PlaceRecommendation => ({
          id: r.id,
          senderId: r.sender_id,
          receiverId: r.receiver_id,
          placeId: r.place_id,
          collectionId: r.collection_id,
          message: r.message,
          createdAt: r.created_at,
        }),
      ),
      notifications: must(notes).map(
        (r: Row): AppNotification => ({
          id: r.id,
          userId: r.user_id,
          actorId: r.actor_id,
          type: r.type,
          referenceId: r.reference_id,
          isRead: r.is_read,
          createdAt: r.created_at,
        }),
      ),
    };
    return { db, meId: meCache };
  },

  async upsertPlace(place) {
    const sb = getSupabaseBrowser();
    if (place.googlePlaceId) {
      const existing = await sb.from("places").select("*").eq("google_place_id", place.googlePlaceId).maybeSingle();
      if (existing.data) return toPlace(existing.data);
    }
    const row = must(await sb.from("places").insert(fromPlace(place, meCache!)).select().single());
    return toPlace(row);
  },

  async upsertReview(r) {
    const sb = getSupabaseBrowser();
    must(
      await sb.from("reviews").upsert(
        {
          id: r.id,
          user_id: r.userId,
          place_id: r.placeId,
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
        },
        { onConflict: "user_id,place_id" },
      ),
    );
    // Replace photo rows with the current set.
    must(await sb.from("review_photos").delete().eq("review_id", r.id));
    if (r.photos.length) must(await sb.from("review_photos").insert(r.photos.map((image_url) => ({ review_id: r.id, image_url }))));
  },

  async deleteReview(id) {
    must(await getSupabaseBrowser().from("reviews").delete().eq("id", id));
  },

  async uploadPhoto(file, meId) {
    const sb = getSupabaseBrowser();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${meId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from("review-photos").upload(path, file, { contentType: file.type });
    if (error) throw new Error(error.message);
    return sb.storage.from("review-photos").getPublicUrl(path).data.publicUrl;
  },

  async setSaved(row, saved) {
    const t = getSupabaseBrowser().from("saved_places");
    if (saved) must(await t.insert({ id: row.id, user_id: row.userId, place_id: row.placeId }));
    else must(await t.delete().eq("user_id", row.userId).eq("place_id", row.placeId));
  },

  async upsertCollection(c) {
    must(
      await getSupabaseBrowser().from("collections").upsert({
        id: c.id,
        user_id: c.userId,
        title: c.title,
        description: c.description,
        cover_image: c.coverImage,
        visibility: c.visibility,
      }),
    );
  },

  async deleteCollection(id) {
    must(await getSupabaseBrowser().from("collections").delete().eq("id", id));
  },

  async setCollectionPlaces(collectionId, rows) {
    const sb = getSupabaseBrowser();
    must(await sb.from("collection_places").delete().eq("collection_id", collectionId));
    if (rows.length)
      must(
        await sb
          .from("collection_places")
          .insert(rows.map((r) => ({ id: r.id, collection_id: collectionId, place_id: r.placeId, position: r.position }))),
      );
  },

  async setCollectionFollow(row, following) {
    const t = getSupabaseBrowser().from("collection_follows");
    if (following) must(await t.insert({ id: row.id, user_id: row.userId, collection_id: row.collectionId }));
    else must(await t.delete().eq("user_id", row.userId).eq("collection_id", row.collectionId));
  },

  async upsertFriendship(f) {
    const t = () => getSupabaseBrowser().from("friendships");
    // Status changes (accept/decline) must be UPDATEs: an upsert would also be checked
    // against the INSERT policy, which only the requester satisfies.
    const updated = must(await t().update({ status: f.status }).eq("id", f.id).select("id"));
    if (updated.length) return;
    must(await t().insert({ id: f.id, requester_id: f.requesterId, addressee_id: f.addresseeId, status: f.status }));
  },

  async deleteFriendship(id) {
    must(await getSupabaseBrowser().from("friendships").delete().eq("id", id));
  },

  async setFollow(row, following) {
    const t = getSupabaseBrowser().from("follows");
    if (following) must(await t.insert({ id: row.id, follower_id: row.followerId, followee_id: row.followeeId }));
    else must(await t.delete().eq("follower_id", row.followerId).eq("followee_id", row.followeeId));
  },

  async sendRecommendation(r) {
    must(
      await getSupabaseBrowser().from("place_recommendations").insert({
        id: r.id,
        sender_id: r.senderId,
        receiver_id: r.receiverId,
        place_id: r.placeId,
        collection_id: r.collectionId,
        message: r.message,
      }),
    );
  },

  async markNotificationsRead(ids) {
    if (!ids.length) return;
    must(await getSupabaseBrowser().from("notifications").update({ is_read: true }).in("id", ids));
  },

  async updateProfile(p) {
    must(await getSupabaseBrowser().from("profiles").update(fromProfile(p)).eq("id", p.id));
  },

  async signOut() {
    await getSupabaseBrowser().auth.signOut();
  },
};
