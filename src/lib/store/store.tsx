"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { appMode } from "../config";
import { demoBackend } from "../backend/demo";
import { supabaseBackend } from "../backend/supabase";
import type { Backend } from "../backend/types";
import { collectionPlaceIds, relationship } from "../selectors";
import type { Collection, Database, Place, Profile, Review, ReviewInput, Visibility } from "../types";
import { uid } from "../utils";

const EMPTY: Database = {
  profiles: [],
  places: [],
  reviews: [],
  friendships: [],
  follows: [],
  collections: [],
  collectionPlaces: [],
  collectionFollows: [],
  saved: [],
  recommendations: [],
  notifications: [],
};

const now = () => new Date().toISOString();
const newId = () => uid("uuid");

function useStoreValue() {
  const backend: Backend = appMode === "live" ? supabaseBackend : demoBackend;
  const [db, setDb] = useState<Database>(EMPTY);
  const [meId, setMeId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const dbRef = useRef(db);
  dbRef.current = db;

  const reload = useCallback(async () => {
    try {
      const res = await backend.load();
      setDb(res.db);
      setMeId(res.meId);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load data");
    } finally {
      setReady(true);
    }
  }, [backend]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Demo mode persists the whole snapshot locally after every change.
  useEffect(() => {
    if (ready && backend.persist) backend.persist(db);
  }, [db, ready, backend]);

  /** Optimistically apply `mutate`, then persist; on failure, notify and resync. */
  const run = useCallback(
    async (mutate: (d: Database) => Database, remote: () => Promise<unknown>, success?: string) => {
      setDb((d) => mutate(d));
      try {
        await remote();
        if (success) toast.success(success);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
        reload();
      }
    },
    [reload],
  );

  const requireMe = () => {
    if (!meId) throw new Error("Please sign in first");
    return meId;
  };

  const actions = {
    reload,

    async importPlace(place: Place): Promise<Place> {
      const existing = dbRef.current.places.find(
        (p) => p.id === place.id || (place.googlePlaceId && p.googlePlaceId === place.googlePlaceId),
      );
      if (existing) return existing;
      const stored = await backend.upsertPlace({ ...place, id: place.id.startsWith("g:") ? newId() : place.id });
      setDb((d) => ({ ...d, places: [...d.places.filter((p) => p.id !== stored.id), stored] }));
      return stored;
    },

    toggleSave(placeId: string) {
      const me = requireMe();
      const existing = dbRef.current.saved.find((s) => s.userId === me && s.placeId === placeId);
      const row = existing ?? { id: newId(), userId: me, placeId, createdAt: now() };
      return run(
        (d) => ({ ...d, saved: existing ? d.saved.filter((s) => s.id !== existing.id) : [...d.saved, row] }),
        () => backend.setSaved(row, !existing),
        existing ? "Removed from saved" : "Saved to your places",
      );
    },

    saveReview(placeId: string, input: ReviewInput) {
      const me = requireMe();
      // One active review per user per place: editing reuses the existing row.
      const existing = dbRef.current.reviews.find((r) => r.userId === me && r.placeId === placeId);
      const review: Review = {
        ...input,
        id: existing?.id ?? newId(),
        userId: me,
        placeId,
        createdAt: existing?.createdAt ?? now(),
        updatedAt: now(),
      };
      return run(
        (d) => ({ ...d, reviews: [...d.reviews.filter((r) => r.id !== review.id), review] }),
        () => backend.upsertReview(review),
        existing ? "Review updated" : "Review published",
      );
    },

    deleteReview(id: string) {
      return run(
        (d) => ({ ...d, reviews: d.reviews.filter((r) => r.id !== id) }),
        () => backend.deleteReview(id),
        "Review deleted",
      );
    },

    uploadPhoto(file: File) {
      return backend.uploadPhoto(file, requireMe());
    },

    async createCollection(input: { title: string; description?: string; visibility: Visibility; coverImage?: string | null; placeIds?: string[] }) {
      const me = requireMe();
      const c: Collection = {
        id: newId(),
        userId: me,
        title: input.title,
        description: input.description ?? "",
        visibility: input.visibility,
        coverImage: input.coverImage ?? null,
        createdAt: now(),
        updatedAt: now(),
      };
      const rows = (input.placeIds ?? []).map((placeId, position) => ({ id: newId(), collectionId: c.id, placeId, position }));
      await run(
        (d) => ({ ...d, collections: [...d.collections, c], collectionPlaces: [...d.collectionPlaces, ...rows] }),
        async () => {
          await backend.upsertCollection(c);
          if (rows.length) await backend.setCollectionPlaces(c.id, rows);
        },
        "Collection created",
      );
      return c.id;
    },

    updateCollection(c: Collection) {
      const next = { ...c, updatedAt: now() };
      return run(
        (d) => ({ ...d, collections: d.collections.map((x) => (x.id === c.id ? next : x)) }),
        () => backend.upsertCollection(next),
        "Collection updated",
      );
    },

    deleteCollection(id: string) {
      return run(
        (d) => ({
          ...d,
          collections: d.collections.filter((c) => c.id !== id),
          collectionPlaces: d.collectionPlaces.filter((cp) => cp.collectionId !== id),
        }),
        () => backend.deleteCollection(id),
        "Collection deleted",
      );
    },

    setCollectionOrder(collectionId: string, placeIds: string[], message?: string) {
      const rows = placeIds.map((placeId, position) => ({ id: newId(), collectionId, placeId, position }));
      return run(
        (d) => ({
          ...d,
          collectionPlaces: [...d.collectionPlaces.filter((cp) => cp.collectionId !== collectionId), ...rows],
          collections: d.collections.map((c) => (c.id === collectionId ? { ...c, updatedAt: now() } : c)),
        }),
        () => backend.setCollectionPlaces(collectionId, rows),
        message,
      );
    },

    toggleInCollection(collectionId: string, placeId: string) {
      const ids = collectionPlaceIds(dbRef.current, collectionId);
      const has = ids.includes(placeId);
      const title = dbRef.current.collections.find((c) => c.id === collectionId)?.title ?? "collection";
      return actions.setCollectionOrder(
        collectionId,
        has ? ids.filter((x) => x !== placeId) : [...ids, placeId],
        has ? `Removed from “${title}”` : `Added to “${title}”`,
      );
    },

    toggleCollectionFollow(collectionId: string) {
      const me = requireMe();
      const existing = dbRef.current.collectionFollows.find((f) => f.userId === me && f.collectionId === collectionId);
      const row = existing ?? { id: newId(), userId: me, collectionId, createdAt: now() };
      return run(
        (d) => ({
          ...d,
          collectionFollows: existing ? d.collectionFollows.filter((f) => f.id !== existing.id) : [...d.collectionFollows, row],
        }),
        () => backend.setCollectionFollow(row, !existing),
        existing ? "Unfollowed collection" : "Following collection",
      );
    },

    sendFriendRequest(userId: string) {
      const me = requireMe();
      const f = { id: newId(), requesterId: me, addresseeId: userId, status: "pending" as const, createdAt: now() };
      return run((d) => ({ ...d, friendships: [...d.friendships, f] }), () => backend.upsertFriendship(f), "Friend request sent");
    },

    respondFriendRequest(friendshipId: string, accept: boolean) {
      const f = dbRef.current.friendships.find((x) => x.id === friendshipId);
      if (!f) return;
      const next = { ...f, status: accept ? ("accepted" as const) : ("declined" as const) };
      return run(
        (d) => ({
          ...d,
          friendships: d.friendships.map((x) => (x.id === f.id ? next : x)),
          notifications: d.notifications.map((n) => (n.referenceId === f.id ? { ...n, isRead: true } : n)),
        }),
        async () => {
          await backend.upsertFriendship(next);
          const noteIds = dbRef.current.notifications.filter((n) => n.referenceId === f.id && !n.isRead).map((n) => n.id);
          await backend.markNotificationsRead(noteIds);
        },
        accept ? "You're now friends" : "Request declined",
      );
    },

    removeFriendship(otherId: string) {
      const me = requireMe();
      const f = dbRef.current.friendships.find(
        (x) => (x.requesterId === me && x.addresseeId === otherId) || (x.requesterId === otherId && x.addresseeId === me),
      );
      if (!f) return;
      const rel = relationship(dbRef.current, me, otherId);
      return run(
        (d) => ({ ...d, friendships: d.friendships.filter((x) => x.id !== f.id) }),
        () => backend.deleteFriendship(f.id),
        rel === "pending_out" ? "Request cancelled" : "Removed from friends",
      );
    },

    toggleFollow(userId: string) {
      const me = requireMe();
      const existing = dbRef.current.follows.find((f) => f.followerId === me && f.followeeId === userId);
      const row = existing ?? { id: newId(), followerId: me, followeeId: userId, createdAt: now() };
      return run(
        (d) => ({ ...d, follows: existing ? d.follows.filter((f) => f.id !== existing.id) : [...d.follows, row] }),
        () => backend.setFollow(row, !existing),
        existing ? "Unfollowed" : "Following",
      );
    },

    sendRecommendation(input: { receiverIds: string[]; placeId?: string; collectionId?: string; message: string }) {
      const me = requireMe();
      const rows = input.receiverIds.map((receiverId) => ({
        id: newId(),
        senderId: me,
        receiverId,
        placeId: input.placeId ?? null,
        collectionId: input.collectionId ?? null,
        message: input.message,
        createdAt: now(),
      }));
      return run(
        (d) => ({ ...d, recommendations: [...rows, ...d.recommendations] }),
        () => Promise.all(rows.map((r) => backend.sendRecommendation(r))),
        `Shared with ${rows.length} ${rows.length === 1 ? "friend" : "friends"}`,
      );
    },

    markAllNotificationsRead() {
      const me = meId;
      const ids = dbRef.current.notifications.filter((n) => n.userId === me && !n.isRead).map((n) => n.id);
      if (!ids.length) return;
      return run(
        (d) => ({ ...d, notifications: d.notifications.map((n) => (ids.includes(n.id) ? { ...n, isRead: true } : n)) }),
        () => backend.markNotificationsRead(ids),
      );
    },

    updateProfile(patch: Partial<Profile>) {
      const me = requireMe();
      const current = dbRef.current.profiles.find((p) => p.id === me);
      if (!current) return;
      const next = { ...current, ...patch, privacy: { ...current.privacy, ...(patch.privacy ?? {}) } };
      return run(
        (d) => ({ ...d, profiles: d.profiles.map((p) => (p.id === me ? next : p)) }),
        () => backend.updateProfile(next),
        "Profile saved",
      );
    },

    async signOut() {
      await backend.signOut?.();
      window.location.href = "/login";
    },
  };

  const me = useMemo(() => db.profiles.find((p) => p.id === meId) ?? null, [db.profiles, meId]);

  return { db, meId: meId ?? "", me, ready, loadError, mode: backend.mode, actions };
}

export type Store = ReturnType<typeof useStoreValue>;

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue();
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
