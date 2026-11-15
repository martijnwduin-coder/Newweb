"use client";
import { ArrowLeft, Clock, ExternalLink, FolderPlus, Globe, MapPin, Navigation, Phone, Share, Star, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import { AddToCollectionDialog } from "@/components/collections/add-to-collection";
import { PlaceCard, placeShareTarget } from "@/components/place/place-card";
import { PlaceImage } from "@/components/place/place-image";
import { GoogleRating } from "@/components/place/rating";
import { ReviewCard } from "@/components/place/review-card";
import { ReviewDialog } from "@/components/place/review-form";
import { SaveButton } from "@/components/place/save-button";
import { ShareDialog } from "@/components/social/share-dialog";
import { AvatarStack } from "@/components/ui/avatar";
import { DemoBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Rail, SectionHeader } from "@/components/ui/rail";
import { Stars } from "@/components/ui/stars";
import { friendIds, myReview, placeById, placeStats, reviewsForPlace, trustedIds } from "@/lib/selectors";
import { useStore } from "@/lib/store/store";
import { CATEGORY_META, directionsUrl, distanceKm, formatRating, priceLabel } from "@/lib/utils";

export default function PlacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { db, meId } = useStore();
  const place = placeById(db, decodeURIComponent(id));

  const data = useMemo(() => {
    if (!place) return null;
    const stats = placeStats(db, place.id, meId);
    const reviews = reviewsForPlace(db, place.id, meId);
    const trusted = trustedIds(db, meId);
    const friends = new Set(friendIds(db, meId));
    const fromFriends = reviews.filter((r) => trusted.has(r.userId) || r.userId === meId);
    const others = reviews.filter((r) => !trusted.has(r.userId) && r.userId !== meId);
    const photos = reviews.flatMap((r) => r.photos);
    const similar = db.places
      .filter((p) => p.id !== place.id && (p.category === place.category || (p.cuisine && p.cuisine === place.cuisine)))
      .map((p) => ({ p, d: distanceKm(place, p) }))
      .filter((x) => x.d < 8)
      .sort((a, b) => a.d - b.d)
      .slice(0, 8);
    return { stats, fromFriends, others, photos, similar, friendRecCount: stats.recommenders.filter((p) => friends.has(p.id)).length };
  }, [db, meId, place]);

  if (!place || !data) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24">
        <EmptyState
          icon={MapPin}
          title="Place not found"
          body="It may have been removed, or the link is from someone else's demo session."
          action={
            <Button asChild>
              <Link href="/map">Explore the map</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const { stats, fromFriends, others, photos, similar } = data;
  const mine = myReview(db, meId, place.id);
  const breakdown = [
    ["Food", stats.breakdown.food],
    ["Drinks", stats.breakdown.drinks],
    ["Atmosphere", stats.breakdown.atmosphere],
    ["Service", stats.breakdown.service],
    ["Value for money", stats.breakdown.value],
  ] as const;

  return (
    <div className="pb-16">
      {/* Cover */}
      <div className="relative h-[46vh] min-h-[320px] w-full overflow-hidden bg-cream-200 lg:h-[420px]">
        <PlaceImage src={place.imageUrl} alt={place.name} category={place.category} className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal/85 via-charcoal/20 to-charcoal/10" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 sm:p-6">
          <button onClick={() => (history.length > 1 ? router.back() : router.push("/"))} className="grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow-soft backdrop-blur" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-2">
            <ShareDialog target={placeShareTarget(place, stats.rating)}>
              <button className="grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow-soft backdrop-blur" aria-label="Share">
                <Share className="h-4 w-4" />
              </button>
            </ShareDialog>
            <SaveButton placeId={place.id} className="h-10 w-10" />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[1100px] px-4 pb-6 text-white sm:px-8 sm:pb-8">
          <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-white/85">
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 backdrop-blur">{CATEGORY_META[place.category].label}</span>
            {place.cuisine && <span>{place.cuisine}</span>}
            {priceLabel(place.priceLevel) && <span>· {priceLabel(place.priceLevel)}</span>}
            {place.source === "demo" && <DemoBadge className="border-white/60 text-white" />}
          </div>
          <h1 className="display mt-2 text-[38px] sm:text-[56px]">{place.name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-[14px] text-white/80">
            <MapPin className="h-4 w-4" /> {place.address}
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1100px] gap-10 px-4 pt-6 sm:px-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-12">
          {/* Stats + actions */}
          <section>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">Peloton rating</p>
                <p className="mt-1 flex items-center gap-2">
                  <span className="text-[34px] font-semibold tracking-tight">{formatRating(stats.rating)}</span>
                  {stats.rating != null && <Stars value={stats.rating} size={16} />}
                </p>
                <p className="text-[13px] text-muted">
                  {stats.count} Peloton {stats.count === 1 ? "review" : "reviews"}
                </p>
              </div>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">Your circle</p>
                <p className="mt-1 flex items-center gap-2 text-[34px] font-semibold tracking-tight">
                  {stats.recommenders.length}
                  {stats.recommenders.length > 0 && <AvatarStack users={stats.recommenders} size="sm" />}
                </p>
                <p className="text-[13px] text-muted">friends recommend it</p>
              </div>
              {stats.friendRating != null && (
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">Friends&apos; average</p>
                  <p className="mt-1 text-[34px] font-semibold tracking-tight text-terracotta">{formatRating(stats.friendRating)}</p>
                  <p className="text-[13px] text-muted">from {stats.friendCount} {stats.friendCount === 1 ? "person" : "people"} you trust</p>
                </div>
              )}
              {place.googleRating != null && (
                <div className="sm:ml-auto">
                  <GoogleRating rating={place.googleRating} count={place.googleRatingCount} />
                  <p className="mt-1 text-[11px] text-muted">External rating, not from Peloton members</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <ReviewDialog place={place}>
                <Button size="lg" variant={mine ? "soft" : "default"}>
                  <Star className={mine ? "fill-current" : ""} /> {mine ? `Your rating · ${mine.overall.toFixed(1)}` : "Rate & review"}
                </Button>
              </ReviewDialog>
              <SaveButton placeId={place.id} variant="full" className="h-12 px-5" />
              <AddToCollectionDialog placeId={place.id}>
                <Button size="lg" variant="outline">
                  <FolderPlus /> Add to list
                </Button>
              </AddToCollectionDialog>
              <ShareDialog target={placeShareTarget(place, stats.rating)}>
                <Button size="lg" variant="outline">
                  <Share /> Share
                </Button>
              </ShareDialog>
            </div>
            {place.description && <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-charcoal/85">{place.description}</p>}
          </section>

          {/* 1. Breakdown */}
          {stats.count > 0 && (
            <section>
              <SectionHeader title="Community rating" subtitle="How Peloton members score the details" />
              <div className="grid gap-x-10 gap-y-3 rounded-3xl bg-white p-6 shadow-soft sm:grid-cols-2">
                {breakdown.map(([label, v]) => (
                  <div key={label}>
                    <div className="flex justify-between text-[13.5px]">
                      <span>{label}</span>
                      <span className="font-semibold tabular-nums">{formatRating(v)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cream-200">
                      <div className="h-full rounded-full bg-forest transition-all duration-700" style={{ width: `${((v ?? 0) / 5) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {stats.topTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2 sm:col-span-2">
                    {stats.topTags.map((t) => (
                      <span key={t.tag} className="rounded-full bg-cream-200 px-2.5 py-1 text-[12px] capitalize text-charcoal">
                        {t.tag} <span className="text-muted">· {t.count}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 2. Friends */}
          <section>
            <SectionHeader title="From your friends" subtitle="Reviews from people you know and follow, first" />
            {fromFriends.length ? (
              <div className="space-y-3">
                {fromFriends.map((r) => (
                  <ReviewCard key={r.id} review={r} place={place} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Users}
                title="None of your friends have reviewed this yet"
                body="Be the first in your circle — or send it to a friend who'd love it."
                action={
                  <ReviewDialog place={place}>
                    <Button>Write the first review</Button>
                  </ReviewDialog>
                }
              />
            )}
          </section>

          {/* 3. Community */}
          {others.length > 0 && (
            <section>
              <SectionHeader title="All community reviews" subtitle={`${others.length} more from the Peloton community`} />
              <div className="space-y-3">
                {others.map((r) => (
                  <ReviewCard key={r.id} review={r} place={place} />
                ))}
              </div>
            </section>
          )}

          {/* 5. Photos */}
          {photos.length > 0 && (
            <section>
              <SectionHeader title="Photos from the community" />
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="" className="aspect-square w-full rounded-2xl object-cover" />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {stats.topItems.length > 0 && (
            <div className="rounded-3xl bg-forest p-6 text-cream shadow-lift">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-sage">Recommended to order</p>
              <ul className="mt-3 space-y-2">
                {stats.topItems.map((i) => (
                  <li key={i.item} className="flex items-center justify-between gap-3 text-[15px]">
                    <span>{i.item}</span>
                    <span className="text-[12px] text-cream/60">
                      {i.count} {i.count === 1 ? "mention" : "mentions"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-4 rounded-3xl bg-white p-6 shadow-soft">
            <InfoRow icon={MapPin} label="Address">
              {place.address}
              <a href={directionsUrl(place)} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 font-medium text-forest hover:underline">
                <Navigation className="h-3.5 w-3.5" /> Directions in Google Maps
              </a>
            </InfoRow>
            {place.openingHours?.length ? (
              <InfoRow icon={Clock} label="Opening hours">
                <ul className="space-y-0.5">
                  {place.openingHours.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </InfoRow>
            ) : null}
            {place.website && (
              <InfoRow icon={Globe} label="Website">
                <a href={place.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all font-medium text-forest hover:underline">
                  {place.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")} <ExternalLink className="h-3 w-3" />
                </a>
              </InfoRow>
            )}
            {place.phone && (
              <InfoRow icon={Phone} label="Phone">
                <a href={`tel:${place.phone}`} className="font-medium text-forest">
                  {place.phone}
                </a>
              </InfoRow>
            )}
            {place.source === "demo" && <p className="border-t border-cream-200 pt-3 text-[12px] text-muted">This is a fictional demo venue. Hours and address are illustrative.</p>}
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/map?place=${place.id}&city=${encodeURIComponent(place.city)}`}>
              <MapPin /> Show on map
            </Link>
          </Button>
        </aside>
      </div>

      {/* 6. Similar */}
      {similar.length > 0 && (
        <section className="mx-auto mt-14 max-w-[1100px] px-4 sm:px-8">
          <SectionHeader title="Similar places nearby" subtitle={`More ${place.cuisine?.toLowerCase() ?? CATEGORY_META[place.category].plural.toLowerCase()} around ${place.neighborhood ?? place.city}`} />
          <Rail>
            {similar.map(({ p, d }) => (
              <PlaceCard key={p.id} place={p} note={<span className="text-muted">{d < 1 ? `${Math.round(d * 1000)} m away` : `${d.toFixed(1)} km away`}</span>} />
            ))}
          </Rail>
        </section>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <div className="min-w-0 text-[14px] text-charcoal">
        <p className="text-[12px] font-medium text-muted">{label}</p>
        {children}
      </div>
    </div>
  );
}
