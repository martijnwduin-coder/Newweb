"use client";
import { Search, Sparkles, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ActivityItem } from "@/components/social/activity-item";
import { UserActions } from "@/components/social/user-actions";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, SectionHeader } from "@/components/ui/rail";
import { activityFeed, followingIds, friendIds, profileById, tasteProfile } from "@/lib/selectors";
import { useStore } from "@/lib/store/store";
import type { Profile } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

export default function FriendsPage() {
  const { db, meId } = useStore();
  const [q, setQ] = useState("");
  const feed = useMemo(() => activityFeed(db, meId, { limit: 40 }), [db, meId]);
  const friends = friendIds(db, meId).map((id) => profileById(db, id)).filter(Boolean) as Profile[];
  const following = followingIds(db, meId)
    .filter((id) => !friends.some((f) => f.id === id))
    .map((id) => profileById(db, id))
    .filter(Boolean) as Profile[];
  const incoming = db.friendships.filter((f) => f.addresseeId === meId && f.status === "pending");
  const outgoing = db.friendships.filter((f) => f.requesterId === meId && f.status === "pending");

  const results = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/^@/, "");
    if (!s) return [];
    return db.profiles.filter((p) => p.id !== meId && (p.fullName.toLowerCase().includes(s) || p.username.toLowerCase().includes(s))).slice(0, 8);
  }, [db.profiles, q, meId]);

  // Friends-of-friends you're not connected with yet, ranked by mutuals.
  const suggestions = useMemo(() => {
    const mine = new Set([meId, ...friends.map((f) => f.id)]);
    const counts = new Map<string, number>();
    for (const f of friends) for (const ff of friendIds(db, f.id)) if (!mine.has(ff)) counts.set(ff, (counts.get(ff) ?? 0) + 1);
    const pendingIds = new Set([...incoming.map((f) => f.requesterId), ...outgoing.map((f) => f.addresseeId)]);
    const extra = db.profiles.filter((p) => !mine.has(p.id) && !counts.has(p.id) && !pendingIds.has(p.id) && p.privacy.profile === "public");
    return [
      ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ p: profileById(db, id)!, mutual: n })),
      ...extra.map((p) => ({ p, mutual: 0 })),
    ]
      .filter((x) => x.p && !pendingIds.has(x.p.id))
      .slice(0, 5);
  }, [db, meId, friends, incoming, outgoing]);

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-16 pt-6 sm:px-8 lg:pt-10">
      <header className="animate-fade-up">
        <h1 className="display text-[32px] text-ink sm:text-[40px]">Your table</h1>
        <p className="mt-2 max-w-xl text-[15px] text-muted">Where your friends are eating, drinking and saving. Recommendations from people, not algorithms.</p>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          {incoming.length > 0 && (
            <section className="mb-10">
              <SectionHeader title="Friend requests" />
              <div className="space-y-2">
                {incoming.map((f) => {
                  const p = profileById(db, f.requesterId);
                  if (!p) return null;
                  return <PersonRow key={f.id} p={p} meta={`Sent ${timeAgo(f.createdAt)}`} />;
                })}
              </div>
            </section>
          )}

          <SectionHeader title="Activity" subtitle="The latest from friends and people you follow" />
          {feed.length ? (
            <div className="space-y-3">
              {feed.map((e) => (
                <ActivityItem key={e.id} event={e} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Sparkles} title="Quiet table" body="Add a few friends and their reviews, saves and lists will appear here." />
          )}
        </div>

        <aside className="space-y-8 lg:sticky lg:top-6 lg:self-start">
          <section>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search people by name or @username"
                aria-label="Search people"
                className="h-12 w-full rounded-full border border-paper-300 bg-white pl-11 pr-4 text-[14.5px] shadow-soft focus:border-stone focus:outline-none focus:ring-4 focus:ring-stone/25"
              />
            </div>
            {q && (
              <div className="mt-3 space-y-1">
                {results.length ? results.map((p) => <PersonRow key={p.id} p={p} compact />) : <p className="px-2 text-sm text-muted">No one found for “{q}”.</p>}
              </div>
            )}
          </section>

          {suggestions.length > 0 && (
            <section>
              <h2 className="mb-3 text-[15px] font-semibold">People you may know</h2>
              <div className="space-y-1">
                {suggestions.map(({ p, mutual }) => (
                  <PersonRow key={p.id} p={p} compact meta={mutual ? `${mutual} mutual ${mutual === 1 ? "friend" : "friends"}` : p.location ?? undefined} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 flex items-center justify-between text-[15px] font-semibold">
              Friends <span className="text-[13px] font-normal text-muted">{friends.length}</span>
            </h2>
            {friends.length ? (
              <div className="grid grid-cols-4 gap-3">
                {friends.map((f) => (
                  <Link key={f.id} href={`/u/${f.username}`} className="flex flex-col items-center gap-1.5 text-center">
                    <Avatar user={f} size="lg" />
                    <span className="w-full truncate text-[12px]">{f.fullName.split(" ")[0]}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState icon={Users} title="No friends yet" body="Search above to find people." />
            )}
          </section>

          {following.length > 0 && (
            <section>
              <h2 className="mb-3 text-[15px] font-semibold">Following</h2>
              <div className="space-y-1">
                {following.map((p) => (
                  <PersonRow key={p.id} p={p} compact />
                ))}
              </div>
            </section>
          )}

          {outgoing.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
                <UserPlus className="h-4 w-4" /> Pending requests
              </h2>
              <div className="space-y-1">
                {outgoing.map((f) => {
                  const p = profileById(db, f.addresseeId);
                  return p ? <PersonRow key={f.id} p={p} compact meta="Waiting for a reply" /> : null;
                })}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function PersonRow({ p, compact, meta }: { p: Profile; compact?: boolean; meta?: string }) {
  const { db } = useStore();
  const taste = tasteProfile(db, p.id);
  return (
    <div className={compact ? "flex items-center gap-3 rounded-2xl p-2 hover:bg-white/70" : "flex items-center gap-3 rounded-3xl bg-white p-4 shadow-soft"}>
      <Link href={`/u/${p.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar user={p} size={compact ? "md" : "lg"} />
        <span className="min-w-0">
          <span className="block truncate text-[14.5px] font-semibold">{p.fullName}</span>
          <span className="block truncate text-[12.5px] text-muted">{meta ?? (taste.reviewCount >= 3 ? taste.title : `@${p.username}`)}</span>
        </span>
      </Link>
      <UserActions userId={p.id} showFollow={!compact} />
    </div>
  );
}
