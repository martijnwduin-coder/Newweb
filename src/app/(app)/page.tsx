"use client";
import { ArrowUpRight, Bookmark, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PlaceImage } from "@/components/place/place-image";
import { FriendPickCard, PlaceCard, placeSubtitle } from "@/components/place/place-card";
import { SearchBar } from "@/components/shell/search-bar";
import { Avatar } from "@/components/ui/avatar";
import { ArrowButton } from "@/components/ui/arrow-button";
import { Button } from "@/components/ui/button";
import { EmptyState, Rail, SectionHeader } from "@/components/ui/rail";
import { activityFeed, cities, communityFavourites, friendPicks, placeById, placeStats, profileById, trustedIds } from "@/lib/selectors";
import { useStore } from "@/lib/store/store";
import { cn, greeting, timeAgo } from "@/lib/utils";

export default function DiscoverPage() {
  const { db, meId, me, mode } = useStore();
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

  const cityList = cities(db);

  return (
    <div>
      {/* Hero — full-bleed dark, oversized light type */}
      <section className="section-dark relative overflow-hidden px-4 pb-16 pt-14 sm:px-8 lg:pb-24 lg:pt-24">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-accent/20 blur-[120px]" />
        <div className="relative mx-auto max-w-[1440px] animate-fade-up">
          <p className="eyebrow text-paper/50">
            {[firstName ? `Hi ${firstName}` : null, new Date().toLocaleDateString("en-GB", { weekday: "long" }), me?.location].filter(Boolean).join("  ·  ")}
          </p>
          <h1 className="display mt-6 max-w-[14ch] text-[52px] sm:text-[88px] lg:text-[128px]">
            {greeting()}. Where should we <span className="text-accent">go?</span>
          </h1>
          <div className="mt-10 flex flex-col gap-4 lg:mt-14 lg:flex-row lg:items-center">
            <SearchBar className="w-full lg:max-w-xl" large />
            <ArrowButton href="/assistant" className="self-start lg:self-auto">
              Ask Peloton
            </ArrowButton>
          </div>
          <div className="no-scrollbar -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {[null, ...cityList].map((c) => {
              const active = city === c;
              return (
                <button
                  key={c ?? "all"}
                  onClick={() => setCity(c === city ? null : c)}
                  aria-pressed={active}
                  className={cn(
                    "h-10 shrink-0 rounded-full border px-5 text-[14px] transition-colors duration-300",
                    active ? "border-paper bg-paper text-ink" : "border-white/20 text-paper/80 hover:border-white/60",
                  )}
                >
                  {c ?? "Everywhere"}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        {/* Inbox */}
        {inbox.length > 0 && !city && (
          <section className="mt-20">
            <SectionHeader index="Sent to you" title="Personal recommendations" />
            <div className="grid gap-px overflow-hidden rounded-3xl bg-paper-300 sm:grid-cols-2 lg:grid-cols-3">
              {inbox.map((r) => {
                const from = profileById(db, r.senderId);
                const place = r.placeId ? placeById(db, r.placeId) : null;
                const collection = r.collectionId ? db.collections.find((c) => c.id === r.collectionId) : null;
                if (!from || (!place && !collection)) return null;
                return (
                  <Link key={r.id} href={place ? `/place/${place.id}` : `/collections/${collection!.id}`} className="group flex gap-4 bg-paper p-5 transition-colors duration-300 hover:bg-white">
                    <PlaceImage src={place?.imageUrl ?? collection?.coverImage} alt="" category={place?.category} className="h-20 w-20 shrink-0 rounded-2xl" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[12px] text-muted">
                        <Avatar user={from} size="xs" /> {from.fullName.split(" ")[0]} · {timeAgo(r.createdAt)}
                      </p>
                      <p className="mt-1 truncate text-[17px] font-medium tracking-tight">{place?.name ?? collection?.title}</p>
                      <p className="line-clamp-2 text-[13.5px] leading-snug text-charcoal/75">“{r.message}”</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* 01 Friends */}
        <section className="mt-20 lg:mt-28">
          <SectionHeader index="01 — Your friends" title="Recommended by people you trust" subtitle="Places your friends rated 4★ and up." href="/friends" />
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
      </div>

      {/* 02 Community — dark band */}
      {popular.length > 0 && (
        <section className="section-dark mx-2 mt-24 rounded-[2.5rem] px-4 py-16 sm:mx-4 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-[1440px]">
            <SectionHeader dark index="02 — Your community" title="Popular in your circle" subtitle="Highest rated by your friends and their friends." href="/map" />
            <Rail>
              {popular.map(({ place, count }) => (
                <PlaceCard key={place.id} place={place} dark note={<span className="text-paper/50">{count} {count === 1 ? "rating" : "ratings"} in your network</span>} />
              ))}
            </Rail>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        {/* 03 Recent */}
        {recent.length > 0 && (
          <section className="mt-24">
            <SectionHeader index="03 — Fresh" title="Recently added" subtitle="New reviews and saves from your friends." href="/friends" />
            <div className="border-t border-ink/10">
              {recent.map((e) =>
                e.kind === "review" || e.kind === "save" ? (
                  <Link key={e.id} href={`/place/${e.place.id}`} className="group flex items-center gap-4 border-b border-ink/10 py-4 transition-colors duration-300 hover:bg-white/60 sm:px-2">
                    <span className="relative shrink-0">
                      <PlaceImage src={e.place.imageUrl} alt="" category={e.place.category} className="h-16 w-16 rounded-2xl" />
                      <Avatar user={e.actor} size="xs" ring className="absolute -bottom-1 -right-1" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[18px] font-medium tracking-tight sm:text-[22px]">{e.place.name}</span>
                      <span className="block truncate text-[13.5px] text-muted">
                        {e.actor.fullName.split(" ")[0]} {e.kind === "review" ? `rated it ${e.review.overall.toFixed(1)}★` : "saved it"} · {placeSubtitle(e.place)}
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-[13px] text-muted sm:block">{timeAgo(e.at)}</span>
                    <ArrowUpRight className="h-5 w-5 shrink-0 text-muted transition-all duration-500 group-hover:rotate-45 group-hover:text-accent" />
                  </Link>
                ) : null,
              )}
            </div>
          </section>
        )}

        {/* 04 Coffee */}
        {coffee.length > 0 && (
          <section className="mt-24">
            <SectionHeader index="04 — Coffee" title="Coffee spots worth the detour" subtitle="Specialty coffee and cafés, ranked by your network." />
            <Rail>
              {coffee.map(({ p }) => (
                <PlaceCard key={p.id} place={p} />
              ))}
            </Rail>
          </section>
        )}

        {/* 05 Saved */}
        <section className="mt-24">
          <SectionHeader index="05 — Saved" title="Your saved places" subtitle={`${saved.length} ${saved.length === 1 ? "place" : "places"} waiting for you.`} href="/profile?tab=saved" />
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

        {mode === "demo" && <p className="mt-16 text-center text-[12px] text-muted">Demo mode: places, people and ratings shown are fictional sample data.</p>}
      </div>
    </div>
  );
}
