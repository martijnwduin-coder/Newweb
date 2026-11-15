"use client";
import { ArrowRight, Bell, Bookmark, Coffee, Inbox, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PlaceImage } from "@/components/place/place-image";
import { FriendPickCard, PlaceCard, placeSubtitle } from "@/components/place/place-card";
import { SearchBar } from "@/components/shell/search-bar";
import { useUnreadCount } from "@/components/shell/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState, Rail, SectionHeader } from "@/components/ui/rail";
import { activityFeed, cities, communityFavourites, friendPicks, placeById, placeStats, profileById, trustedIds } from "@/lib/selectors";
import { useStore } from "@/lib/store/store";
import { greeting, timeAgo } from "@/lib/utils";

export default function DiscoverPage() {
  const { db, meId, me, mode } = useStore();
  const unread = useUnreadCount();
  const [city, setCity] = useState<string | null>(null);
  const inCity = (placeId: string) => !city || placeById(db, placeId)?.city === city;

  const picks = useMemo(() => friendPicks(db, meId, 20).filter((p) => !city || p.place.city === city), [db, meId, city]);
  const popular = useMemo(() => communityFavourites(db, meId, 20).filter((p) => !city || p.place.city === city).slice(0, 10), [db, meId, city]);
  const recent = useMemo(
    () => activityFeed(db, meId, { limit: 40 }).filter((e) => (e.kind === "review" || e.kind === "save") && inCity(e.place.id)).slice(0, 8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, meId, city],
  );
  const trusted = useMemo(() => trustedIds(db, meId), [db, meId]);
  const coffee = useMemo(
    () =>
      db.places
        .filter((p) => (p.category === "coffee" || p.category === "cafe") && (!city || p.city === city))
        .map((p) => ({ p, s: placeStats(db, p.id, meId) }))
        .sort((a, b) => b.s.friendCount - a.s.friendCount || (b.s.rating ?? 0) - (a.s.rating ?? 0))
        .slice(0, 10),
    [db, meId, city],
  );
  const saved = useMemo(
    () =>
      db.saved
        .filter((s) => s.userId === meId && inCity(s.placeId))
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .map((s) => placeById(db, s.placeId))
        .filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, meId, city],
  );
  const inbox = db.recommendations.filter((r) => r.receiverId === meId).slice(0, 3);
  const firstName = me?.fullName.split(" ")[0];

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-8 lg:pt-10">
      {/* Desktop top bar */}
      <div className="mb-10 hidden items-center gap-4 lg:flex">
        <SearchBar className="max-w-xl flex-1" />
        <div className="ml-auto flex items-center gap-2">
          {mode === "demo" && <DemoBadge />}
          <Link href="/notifications" className="relative grid h-11 w-11 place-items-center rounded-full bg-white shadow-soft hover:shadow-lift" aria-label="Notifications">
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-terracotta px-1 text-[11px] font-semibold text-white ring-2 ring-cream">{unread}</span>}
          </Link>
          {me && (
            <Link href="/profile">
              <Avatar user={me} size="md" className="shadow-soft" />
            </Link>
          )}
        </div>
      </div>

      {/* Hero */}
      <section className="animate-fade-up">
        <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-terracotta">{[firstName ? `Hi ${firstName}` : null, new Date().toLocaleDateString("en-GB", { weekday: "long" }), me?.location].filter(Boolean).join(" · ")}</p>
        <h1 className="display mt-2 max-w-2xl text-[40px] text-forest sm:text-[56px]">
          {greeting()}.
          <br />
          <span className="text-charcoal">Where should we go?</span>
        </h1>
        <SearchBar className="mt-6 lg:hidden" large />
        <div className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Chip active={!city} onClick={() => setCity(null)}>
            Everywhere
          </Chip>
          {cities(db).map((c) => (
            <Chip key={c} active={city === c} onClick={() => setCity(c === city ? null : c)}>
              {c}
            </Chip>
          ))}
        </div>
      </section>

      {/* AI teaser */}
      <Link
        href="/assistant"
        className="group mt-8 flex items-center gap-4 rounded-3xl bg-forest p-5 text-cream shadow-lift transition hover:bg-forest-700 sm:p-6"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10">
          <Sparkles className="h-5 w-5 text-terracotta" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Ask Peloton</span>
          <span className="block truncate text-[14px] text-cream/70">“Find me a great Italian restaurant in Amsterdam recommended by my friends.”</span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-1" />
      </Link>

      {/* Inbox */}
      {inbox.length > 0 && !city && (
        <section className="mt-10">
          <SectionHeader title="Sent to you" subtitle="Personal recommendations from your friends" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {inbox.map((r) => {
              const from = profileById(db, r.senderId);
              const place = r.placeId ? placeById(db, r.placeId) : null;
              const collection = r.collectionId ? db.collections.find((c) => c.id === r.collectionId) : null;
              if (!from || (!place && !collection)) return null;
              return (
                <Link
                  key={r.id}
                  href={place ? `/place/${place.id}` : `/collections/${collection!.id}`}
                  className="flex gap-3 rounded-2xl bg-white p-3 shadow-soft transition hover:shadow-lift"
                >
                  <PlaceImage src={place?.imageUrl ?? collection?.coverImage} alt="" category={place?.category} className="h-[72px] w-[72px] shrink-0 rounded-xl" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[12px] text-muted">
                      <Inbox className="h-3 w-3" /> {from.fullName.split(" ")[0]} · {timeAgo(r.createdAt)}
                    </p>
                    <p className="truncate text-[15px] font-semibold">{place?.name ?? collection?.title}</p>
                    <p className="line-clamp-2 text-[13px] leading-snug text-charcoal/80">“{r.message}”</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* A. Friends */}
      <section className="mt-12">
        <SectionHeader title="Recommended by your friends" subtitle="Places people you trust rated 4★ and up" href="/friends" />
        {picks.length ? (
          <Rail>
            {picks.map((p) => (
              <FriendPickCard key={p.place.id} {...p} />
            ))}
          </Rail>
        ) : (
          <EmptyState
            icon={Users}
            title={trusted.size ? "No friend picks here yet" : "Your table is empty"}
            body={trusted.size ? "Try another city — or be the first to review a place." : "Add friends to see where they love to eat and drink."}
            action={
              <Button asChild>
                <Link href="/friends">Find friends</Link>
              </Button>
            }
          />
        )}
      </section>

      {/* B. Community */}
      {popular.length > 0 && (
        <section className="mt-12">
          <SectionHeader title="Popular in your community" subtitle="Highest rated by your friends and their friends" href="/map" />
          <Rail>
            {popular.map(({ place, count }) => (
              <PlaceCard key={place.id} place={place} note={<span className="text-muted">{count} {count === 1 ? "rating" : "ratings"} in your network</span>} />
            ))}
          </Rail>
        </section>
      )}

      {/* C. Recent */}
      {recent.length > 0 && (
        <section className="mt-12">
          <SectionHeader title="Recently added" subtitle="Fresh reviews and saves from your friends" href="/friends" />
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {recent.map((e) =>
              e.kind === "review" || e.kind === "save" ? (
                <Link key={e.id} href={`/place/${e.place.id}`} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-white">
                  <span className="relative shrink-0">
                    <PlaceImage src={e.place.imageUrl} alt="" category={e.place.category} className="h-16 w-16 rounded-xl" />
                    <Avatar user={e.actor} size="xs" ring className="absolute -bottom-1 -right-1" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold">{e.place.name}</span>
                    <span className="block truncate text-[13px] text-muted">
                      {e.actor.fullName.split(" ")[0]} {e.kind === "review" ? `rated it ${e.review.overall.toFixed(1)}★` : "saved it"} · {placeSubtitle(e.place)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] text-muted">{timeAgo(e.at)}</span>
                </Link>
              ) : null,
            )}
          </div>
        </section>
      )}

      {/* D. Coffee */}
      {coffee.length > 0 && (
        <section className="mt-12">
          <SectionHeader title="Coffee spots worth discovering" subtitle="Specialty coffee and cafés, ranked by your network" />
          <Rail>
            {coffee.map(({ p }) => (
              <PlaceCard key={p.id} place={p} />
            ))}
          </Rail>
        </section>
      )}

      {/* E. Saved */}
      <section className="mt-12">
        <SectionHeader title="Your saved places" subtitle={`${saved.length} ${saved.length === 1 ? "place" : "places"} waiting for you`} href="/profile?tab=saved" />
        {saved.length ? (
          <Rail>
            {saved.map((p) => (
              <PlaceCard key={p!.id} place={p!} />
            ))}
          </Rail>
        ) : (
          <EmptyState icon={Bookmark} title="Nothing saved yet" body="Tap the bookmark on any place to keep it for later." />
        )}
      </section>

      {mode === "demo" && (
        <p className="mt-16 flex items-center justify-center gap-2 text-center text-[12px] text-muted">
          <Coffee className="h-3.5 w-3.5" /> Demo mode: places, people and ratings shown are fictional sample data.
        </p>
      )}
    </div>
  );
}
