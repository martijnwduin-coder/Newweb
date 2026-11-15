"use client";
import Link from "next/link";
import { PlaceImage } from "@/components/place/place-image";
import { Avatar } from "@/components/ui/avatar";
import { collectionCover, collectionPlaceIds, placeById, profileById } from "@/lib/selectors";
import { useStore } from "@/lib/store/store";
import type { Collection } from "@/lib/types";
import { cn } from "@/lib/utils";
import { VISIBILITY_META } from "./add-to-collection";

export function CollectionCard({ collection, className, size = "md" }: { collection: Collection; className?: string; size?: "md" | "lg" }) {
  const { db, meId } = useStore();
  const ids = collectionPlaceIds(db, collection.id);
  const owner = profileById(db, collection.userId);
  const thumbs = ids.slice(1, 4).map((id) => placeById(db, id)).filter(Boolean);
  const V = VISIBILITY_META[collection.visibility].icon;
  return (
    <Link href={`/collections/${collection.id}`} className={cn("group block", className)}>
      <div className={cn("cover relative overflow-hidden rounded-3xl bg-paper-200", size === "lg" ? "aspect-[4/3]" : "aspect-[5/4]")}>
        <PlaceImage src={collectionCover(db, collection)} alt={collection.title} className="h-full w-full transition duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.08]" />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/5 to-transparent" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-charcoal backdrop-blur">
          <V className="h-3 w-3" /> {VISIBILITY_META[collection.visibility].label}
        </span>
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="text-[12px] font-medium text-white/75">{ids.length} {ids.length === 1 ? "place" : "places"}</p>
          <h3 className={cn("font-normal leading-tight tracking-tight", size === "lg" ? "text-3xl" : "text-[24px]")}>{collection.title}</h3>
        </div>
        {thumbs.length > 0 && (
          <div className="absolute bottom-4 right-4 hidden -space-x-3 sm:flex">
            {thumbs.map((p) => (
              <PlaceImage key={p!.id} src={p!.imageUrl} alt="" category={p!.category} className="h-10 w-10 rounded-xl ring-2 ring-white/90" />
            ))}
          </div>
        )}
      </div>
      {owner && (
        <p className="mt-2.5 flex items-center gap-2 px-0.5 text-[13px] text-muted">
          <Avatar user={owner} size="xs" /> {owner.id === meId ? "You" : owner.fullName}
        </p>
      )}
    </Link>
  );
}
