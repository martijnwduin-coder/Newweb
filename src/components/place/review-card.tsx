"use client";
import { Pencil, Share } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/ui/stars";
import { ShareDialog } from "@/components/social/share-dialog";
import { profileById, relationship } from "@/lib/selectors";
import { useStore } from "@/lib/store/store";
import type { Place, Review } from "@/lib/types";
import { cn, formatDate, timeAgo } from "@/lib/utils";
import { ReviewDialog } from "./review-form";

export function ReviewCard({ review, place, showPlace = false, className }: { review: Review; place?: Place; showPlace?: boolean; className?: string }) {
  const { db, meId } = useStore();
  const author = profileById(db, review.userId);
  if (!author) return null;
  const rel = relationship(db, meId, author.id);
  const isMine = rel === "self";
  const subs = (
    [
      ["Food", review.food],
      ["Drinks", review.drinks],
      ["Atmosphere", review.atmosphere],
      ["Service", review.service],
      ["Value", review.value],
    ] as const
  ).filter(([, v]) => v != null);

  return (
    <article className={cn("rounded-3xl bg-white p-5 shadow-soft", className)}>
      {showPlace && place && (
        <Link href={`/place/${place.id}`} className="mb-3 block text-[15px] font-semibold tracking-tight hover:underline">
          {place.name} <span className="font-normal text-muted">· {place.neighborhood ?? place.city}</span>
        </Link>
      )}
      <header className="flex items-center gap-3">
        <Link href={isMine ? "/profile" : `/u/${author.username}`}>
          <Avatar user={author} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[14px] font-semibold">
            <Link href={isMine ? "/profile" : `/u/${author.username}`} className="truncate hover:underline">
              {isMine ? "You" : author.fullName}
            </Link>
            {rel === "friends" && <Badge variant="sage">Friend</Badge>}
          </p>
          <p className="flex items-center gap-2 text-[12.5px] text-muted">
            <Stars value={review.overall} size={12} />
            <span className="font-semibold text-charcoal">{review.overall.toFixed(1)}</span>· {timeAgo(review.updatedAt)}
            {review.updatedAt !== review.createdAt && " · edited"}
          </p>
        </div>
        <div className="flex gap-1">
          {isMine && place && (
            <ReviewDialog place={place}>
              <button className="rounded-full p-2 text-muted hover:bg-cream-200" aria-label="Edit review">
                <Pencil className="h-4 w-4" />
              </button>
            </ReviewDialog>
          )}
          {place && (
            <ShareDialog
              target={{
                kind: "review",
                id: review.id,
                placeId: place.id,
                title: place.name,
                subtitle: `${isMine ? "My" : `${author.fullName.split(" ")[0]}'s`} review · ${review.overall.toFixed(1)}★`,
                image: review.photos[0] ?? place.imageUrl,
                rating: review.overall,
                ratingLabel: isMine ? "my rating" : `${author.fullName.split(" ")[0]}'s rating`,
              }}
            >
              <button className="rounded-full p-2 text-muted hover:bg-cream-200" aria-label="Share review">
                <Share className="h-4 w-4" />
              </button>
            </ShareDialog>
          )}
        </div>
      </header>
      {review.text && <p className="mt-3 text-[15px] leading-relaxed text-charcoal/90">{review.text}</p>}
      {review.photos.length > 0 && (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {review.photos.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="h-28 w-28 shrink-0 rounded-xl object-cover" />
          ))}
        </div>
      )}
      {review.recommendedItems.length > 0 && (
        <p className="mt-3 text-[13px] text-charcoal">
          <span className="font-semibold text-forest">Order: </span>
          {review.recommendedItems.join(" · ")}
        </p>
      )}
      {(subs.length > 0 || review.tags.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {review.tags.map((t) => (
            <Badge key={t} variant="outline" className="capitalize">
              {t}
            </Badge>
          ))}
          {subs.map(([label, v]) => (
            <Badge key={label} variant="default">
              {label} {v!.toFixed(1)}
            </Badge>
          ))}
        </div>
      )}
      {review.visitedOn && <p className="mt-3 text-[12px] text-muted">Visited {formatDate(review.visitedOn)}</p>}
    </article>
  );
}
