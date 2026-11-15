"use client";
import { Share } from "lucide-react";
import Link from "next/link";
import { AvatarStack, Avatar } from "@/components/ui/avatar";
import { ShareDialog } from "@/components/social/share-dialog";
import { placeStats } from "@/lib/selectors";
import { useStore } from "@/lib/store/store";
import type { Place, Profile, Review } from "@/lib/types";
import { CATEGORY_META, cn, priceLabel } from "@/lib/utils";
import { PlaceImage } from "./place-image";
import { GoogleRating, PelotonRating } from "./rating";
import { SaveButton } from "./save-button";

export function placeSubtitle(p: Place) {
  return [p.neighborhood, p.city].filter(Boolean).join(", ");
}

export function placeShareTarget(p: Place, rating: number | null) {
  return {
    kind: "place" as const,
    id: p.id,
    title: p.name,
    subtitle: [p.cuisine ?? CATEGORY_META[p.category].label, placeSubtitle(p)].filter(Boolean).join(" · "),
    image: p.imageUrl,
    rating,
  };
}

function ShareIconButton({ place, rating }: { place: Place; rating: number | null }) {
  return (
    <ShareDialog target={placeShareTarget(place, rating)}>
      <button
        onClick={(e) => e.stopPropagation()}
        aria-label="Share place"
        className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-charcoal shadow-soft backdrop-blur transition hover:bg-white active:scale-90"
      >
        <Share className="h-4 w-4" />
      </button>
    </ShareDialog>
  );
}

/** Large editorial card used for "Recommended by your friends". */
export function FriendPickCard({ place, review, by, className }: { place: Place; review: Review; by: Profile; className?: string }) {
  const { db, meId } = useStore();
  const stats = placeStats(db, place.id, meId);
  return (
    <article className={cn("group relative w-[78vw] max-w-[320px] shrink-0 snap-start sm:w-[300px]", className)}>
      <Link href={`/place/${place.id}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-cream-200 shadow-soft">
          <PlaceImage src={place.imageUrl} alt={place.name} category={place.category} className="h-full w-full transition duration-700 group-hover:scale-[1.04]" />
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 text-white">
            <div className="mb-1 flex items-center gap-2 text-[12px] font-medium text-white/80">
              <span>{place.cuisine ?? CATEGORY_META[place.category].label}</span>
              {priceLabel(place.priceLevel) && <span>· {priceLabel(place.priceLevel)}</span>}
            </div>
            <h3 className="text-xl font-semibold leading-tight tracking-tight">{place.name}</h3>
            <p className="text-[13px] text-white/75">{placeSubtitle(place)}</p>
          </div>
        </div>
      </Link>
      <div className="absolute right-3 top-3 flex gap-2">
        <ShareIconButton place={place} rating={stats.rating} />
        <SaveButton placeId={place.id} />
      </div>
      <Link href={`/place/${place.id}`} className="mt-3 block rounded-2xl bg-white p-3.5 shadow-soft transition hover:shadow-lift">
        <div className="flex items-center gap-2">
          <Avatar user={by} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-charcoal">
              {by.fullName.split(" ")[0]} <span className="font-normal text-muted">recommends</span>
            </p>
          </div>
          <span className="rounded-full bg-terracotta-50 px-2 py-0.5 text-[12px] font-semibold text-[#9a5638]">★ {review.overall.toFixed(1)}</span>
        </div>
        <p className="mt-2 line-clamp-2 text-[13.5px] leading-snug text-charcoal/85">“{review.text}”</p>
        <div className="mt-2.5 flex items-center justify-between border-t border-cream-200 pt-2.5">
          <PelotonRating rating={stats.rating} count={stats.count} size="sm" />
          {stats.recommenders.length > 1 && (
            <span className="flex items-center gap-1.5 text-[12px] text-muted">
              <AvatarStack users={stats.recommenders} />
              {stats.recommenders.length} friends
            </span>
          )}
        </div>
      </Link>
    </article>
  );
}

/** Standard image-led card for horizontal rails and grids. */
export function PlaceCard({ place, className, note, wide }: { place: Place; className?: string; note?: React.ReactNode; wide?: boolean }) {
  const { db, meId } = useStore();
  const stats = placeStats(db, place.id, meId);
  return (
    <article className={cn("group relative shrink-0 snap-start", wide ? "w-full" : "w-[62vw] max-w-[250px] sm:w-[230px]", className)}>
      <Link href={`/place/${place.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-cream-200">
          <PlaceImage src={place.imageUrl} alt={place.name} category={place.category} className="h-full w-full transition duration-700 group-hover:scale-[1.04]" />
          {stats.recommenders.length > 0 && (
            <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-white/90 py-1 pl-1 pr-2.5 text-[11px] font-medium text-charcoal backdrop-blur">
              <AvatarStack users={stats.recommenders} max={2} />
              {stats.recommenders.length === 1 ? stats.recommenders[0].fullName.split(" ")[0] : `${stats.recommenders.length} friends`}
            </span>
          )}
        </div>
        <div className="mt-2.5 px-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-[15px] font-semibold tracking-tight text-charcoal">{place.name}</h3>
            <PelotonRating rating={stats.rating} count={stats.count} size="sm" className="shrink-0" />
          </div>
          <p className="truncate text-[13px] text-muted">
            {place.cuisine ?? CATEGORY_META[place.category].label} · {placeSubtitle(place)}
          </p>
          {place.googleRating != null && !stats.count && <GoogleRating rating={place.googleRating} count={place.googleRatingCount} className="mt-1" />}
          {note && <div className="mt-1.5 text-[12.5px] text-charcoal/80">{note}</div>}
        </div>
      </Link>
      <div className="absolute right-2.5 top-2.5">
        <SaveButton placeId={place.id} />
      </div>
    </article>
  );
}

/** Dense row used in lists and the map sidebar. */
export function PlaceRow({ place, active, onHover, onClick, distance }: { place: Place; active?: boolean; onHover?: (id: string | null) => void; onClick?: () => void; distance?: number | null }) {
  const { db, meId } = useStore();
  const stats = placeStats(db, place.id, meId);
  const Wrapper = onClick ? "button" : Link;
  return (
    <div
      className={cn("group relative flex gap-3 rounded-2xl p-2 transition", active ? "bg-white shadow-lift" : "hover:bg-white/70")}
      onMouseEnter={() => onHover?.(place.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <Wrapper href={`/place/${place.id}`} onClick={onClick} className="flex min-w-0 flex-1 gap-3 text-left">
        <PlaceImage src={place.imageUrl} alt={place.name} category={place.category} className="h-20 w-20 shrink-0 rounded-xl sm:h-24 sm:w-24" />
        <div className="min-w-0 flex-1 py-0.5">
          <h3 className="truncate pr-10 text-[15px] font-semibold tracking-tight text-charcoal">{place.name}</h3>
          <p className="truncate text-[13px] text-muted">
            {place.cuisine ?? CATEGORY_META[place.category].label}
            {priceLabel(place.priceLevel) ? ` · ${priceLabel(place.priceLevel)}` : ""} · {place.neighborhood ?? place.city}
            {distance != null ? ` · ${distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}` : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <PelotonRating rating={stats.rating} count={stats.count} size="sm" />
            <GoogleRating rating={place.googleRating} count={place.googleRatingCount} />
          </div>
          {stats.recommenders.length > 0 && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-forest">
              <AvatarStack users={stats.recommenders} max={3} />
              <span className="truncate">
                Recommended by {stats.recommenders.slice(0, 2).map((p) => p.fullName.split(" ")[0]).join(" & ")}
                {stats.recommenders.length > 2 ? ` +${stats.recommenders.length - 2}` : ""}
              </span>
            </p>
          )}
        </div>
      </Wrapper>
      <div className="absolute right-2 top-2">
        <SaveButton placeId={place.id} variant="plain" />
      </div>
    </div>
  );
}
