"use client";
import { Bookmark, Library, MapPin, Star } from "lucide-react";
import Link from "next/link";
import { PlaceImage } from "@/components/place/place-image";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import type { ActivityEvent } from "@/lib/selectors";
import { collectionCover } from "@/lib/selectors";
import { useStore } from "@/lib/store/store";
import { timeAgo } from "@/lib/utils";

export function ActivityItem({ event }: { event: ActivityEvent }) {
  const { db } = useStore();
  if (event.kind === "city_saves") {
    return (
      <Link href={`/map?city=${encodeURIComponent(event.city)}&filter=friends`} className="flex items-center gap-4 rounded-3xl bg-ink p-5 text-paper shadow-lift transition hover:bg-ink-700">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10">
          <MapPin className="h-5 w-5 text-accent" />
        </span>
        <span className="flex-1">
          <span className="block text-[15px] font-semibold">Your friends have saved {event.count} places in {event.city}</span>
          <span className="mt-1 flex items-center gap-2 text-[13px] text-paper/70">
            <AvatarStack users={event.actors} max={4} /> See them on the map
          </span>
        </span>
      </Link>
    );
  }

  const actor = event.actor;
  const first = actor.fullName.split(" ")[0];
  const actorLink = (
    <Link href={`/u/${actor.username}`} className="font-semibold hover:underline">
      {first}
    </Link>
  );

  let line: React.ReactNode;
  let href: string;
  let image: string | null | undefined;
  let Icon = Star;
  let body: React.ReactNode = null;
  if (event.kind === "review") {
    href = `/place/${event.place.id}`;
    image = event.review.photos[0] ?? event.place.imageUrl;
    line = (
      <>
        {actorLink} {event.review.overall >= 4.5 ? "recommends" : "rated"}{" "}
        <Link href={href} className="font-semibold hover:underline">
          {event.place.name}
        </Link>{" "}
        <span className="whitespace-nowrap font-semibold text-accent">{event.review.overall.toFixed(1)}★</span>
      </>
    );
    body = event.review.text ? <p className="mt-1.5 line-clamp-3 text-[14px] leading-snug text-charcoal/80">“{event.review.text}”</p> : null;
  } else if (event.kind === "save") {
    Icon = Bookmark;
    href = `/place/${event.place.id}`;
    image = event.place.imageUrl;
    line = (
      <>
        {actorLink} saved{" "}
        <Link href={href} className="font-semibold hover:underline">
          {event.place.name}
        </Link>{" "}
        in {event.place.city}
      </>
    );
  } else {
    Icon = Library;
    href = `/collections/${event.collection.id}`;
    image = collectionCover(db, event.collection);
    line = (
      <>
        {actorLink} created a collection{" "}
        <Link href={href} className="font-semibold hover:underline">
          {event.collection.title}
        </Link>{" "}
        · {event.count} places
      </>
    );
  }

  return (
    <article className="flex gap-3 rounded-3xl bg-white p-4 shadow-soft">
      <Link href={`/u/${actor.username}`} className="relative shrink-0">
        <Avatar user={actor} size="md" />
        <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-paper text-ink ring-2 ring-white">
          <Icon className="h-3 w-3" />
        </span>
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] leading-snug text-charcoal">{line}</p>
        {body}
        <p className="mt-1.5 text-[12px] text-muted">{timeAgo(event.at)}</p>
      </div>
      <Link href={href} className="shrink-0">
        <PlaceImage src={image} alt="" className="h-16 w-16 rounded-2xl sm:h-20 sm:w-20" />
      </Link>
    </article>
  );
}
