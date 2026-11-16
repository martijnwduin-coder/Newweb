"use client";
import { useRouteParam } from "@/lib/use-route-param";
import { ArrowDown, ArrowLeft, ArrowUp, GripVertical, Lock, Pencil, Plus, Search, Share, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { VISIBILITY_META } from "@/components/collections/add-to-collection";
import { CollectionEditor } from "@/components/collections/collection-editor";
import { PlaceImage } from "@/components/place/place-image";
import { PelotonRating } from "@/components/place/rating";
import { SaveButton } from "@/components/place/save-button";
import { ShareDialog } from "@/components/social/share-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/rail";
import { canView, collectionCover, collectionPlaceIds, isFollowingCollection, placeById, placeStats, profileById } from "@/lib/selectors";
import { useStore } from "@/lib/store/store";
import { CATEGORY_META, cn, priceLabel, timeAgo } from "@/lib/utils";

export default function CollectionPageClient() {
  const id = useRouteParam("id");
  const router = useRouter();
  const { db, meId, actions } = useStore();
  const collection = db.collections.find((c) => c.id === id);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  if (!collection || !canView(db, meId, collection.userId, collection.visibility)) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24">
        <EmptyState icon={Lock} title="Collection unavailable" body="It may be private, or it no longer exists." action={<Button asChild><Link href="/collections">Back to collections</Link></Button>} />
      </div>
    );
  }

  const ids = collectionPlaceIds(db, collection.id);
  const places = ids.map((pid) => placeById(db, pid)).filter(Boolean);
  const owner = profileById(db, collection.userId);
  const isOwner = collection.userId === meId;
  const following = isFollowingCollection(db, meId, collection.id);
  const followers = db.collectionFollows.filter((f) => f.collectionId === collection.id).length;
  const V = VISIBILITY_META[collection.visibility].icon;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= ids.length || from === to) return;
    const next = [...ids];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    actions.setCollectionOrder(collection.id, next);
  };

  return (
    <div className="pb-16">
      <div className="relative h-[42vh] min-h-[300px] overflow-hidden bg-paper-200">
        <PlaceImage src={collectionCover(db, collection)} alt={collection.title} className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal/85 via-charcoal/25 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex justify-between p-4 sm:p-6">
          <button onClick={() => router.back()} className="grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow-soft" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[900px] px-4 pb-8 text-white sm:px-8">
          <p className="flex items-center gap-2 text-[13px] text-white/80">
            <V className="h-3.5 w-3.5" /> {VISIBILITY_META[collection.visibility].label} collection · {places.length} places
            {followers > 0 && ` · ${followers} ${followers === 1 ? "follower" : "followers"}`}
          </p>
          <h1 className="display mt-2 text-[38px] sm:text-[54px]">{collection.title}</h1>
          {owner && (
            <Link href={isOwner ? "/profile" : `/u/${owner.username}`} className="mt-3 inline-flex items-center gap-2 text-[14px] text-white/90 hover:underline">
              <Avatar user={owner} size="sm" /> Curated by {isOwner ? "you" : owner.fullName} · updated {timeAgo(collection.updatedAt)}
            </Link>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[900px] px-4 sm:px-8">
        <div className="flex flex-wrap items-center gap-2 py-6">
          <ShareDialog
            target={{
              kind: "collection",
              id: collection.id,
              title: collection.title,
              subtitle: `${places.length} places · by ${owner?.fullName ?? "Peloton"}`,
              image: collectionCover(db, collection),
            }}
          >
            <Button>
              <Share /> Share
            </Button>
          </ShareDialog>
          {isOwner ? (
            <>
              <AddPlacesDialog collectionId={collection.id} existing={ids} />
              <CollectionEditor collection={collection}>
                <Button variant="outline">
                  <Pencil /> Edit
                </Button>
              </CollectionEditor>
              <Button
                variant="ghost"
                className="text-[#C2381A]"
                onClick={() => {
                  if (confirm(`Delete “${collection.title}”?`)) {
                    actions.deleteCollection(collection.id);
                    router.push("/collections");
                  }
                }}
              >
                <Trash2 /> Delete
              </Button>
            </>
          ) : (
            collection.visibility !== "private" && (
              <Button variant={following ? "soft" : "outline"} onClick={() => actions.toggleCollectionFollow(collection.id)}>
                {following ? "Following" : "Follow collection"}
              </Button>
            )
          )}
        </div>

        {collection.description && <p className="max-w-2xl text-[17px] leading-relaxed text-charcoal/85">{collection.description}</p>}

        <ol className="mt-8 space-y-4">
          {places.map((p, i) => {
            const s = placeStats(db, p!.id, meId);
            return (
              <li
                key={p!.id}
                draggable={isOwner}
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => isOwner && e.preventDefault()}
                onDrop={() => {
                  if (dragIndex != null) move(dragIndex, i);
                  setDragIndex(null);
                }}
                className={cn("group flex gap-4 rounded-3xl bg-white p-3 shadow-soft transition sm:p-4", dragIndex === i && "opacity-50")}
              >
                <span className="hidden w-8 shrink-0 pt-1 text-center text-[28px] font-semibold tracking-tight text-stone sm:block">{i + 1}</span>
                <Link href={`/place/${p!.id}`} className="shrink-0">
                  <PlaceImage src={p!.imageUrl} alt={p!.name} category={p!.category} className="h-24 w-24 rounded-2xl sm:h-32 sm:w-40" />
                </Link>
                <div className="min-w-0 flex-1 py-1">
                  <Link href={`/place/${p!.id}`} className="text-[17px] font-semibold tracking-tight hover:underline sm:text-[19px]">
                    <span className="mr-1.5 text-stone sm:hidden">{i + 1}.</span>
                    {p!.name}
                  </Link>
                  <p className="text-[13px] text-muted">
                    {p!.cuisine ?? CATEGORY_META[p!.category].label}
                    {priceLabel(p!.priceLevel) ? ` · ${priceLabel(p!.priceLevel)}` : ""} · {p!.neighborhood}, {p!.city}
                  </p>
                  <PelotonRating rating={s.rating} count={s.count} size="sm" className="mt-1.5" />
                  {p!.description && <p className="mt-1.5 line-clamp-2 hidden text-[13.5px] text-charcoal/75 sm:block">{p!.description}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <SaveButton placeId={p!.id} variant="plain" />
                  {isOwner && (
                    <>
                      <button onClick={() => move(i, i - 1)} disabled={i === 0} className="rounded-full p-1.5 text-muted hover:bg-paper-200 disabled:opacity-30" aria-label="Move up">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <GripVertical className="hidden h-4 w-4 cursor-grab text-paper-300 sm:block" />
                      <button onClick={() => move(i, i + 1)} disabled={i === places.length - 1} className="rounded-full p-1.5 text-muted hover:bg-paper-200 disabled:opacity-30" aria-label="Move down">
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button onClick={() => actions.toggleInCollection(collection.id, p!.id)} className="rounded-full p-1.5 text-muted hover:bg-paper-200" aria-label="Remove from collection">
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {places.length === 0 && <EmptyState icon={Plus} title="This list is empty" body={isOwner ? "Add a few places to bring it to life." : undefined} action={isOwner ? <AddPlacesDialog collectionId={collection.id} existing={ids} /> : undefined} />}
      </div>
    </div>
  );
}

function AddPlacesDialog({ collectionId, existing }: { collectionId: string; existing: string[] }) {
  const { db, actions } = useStore();
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const s = q.toLowerCase();
    return db.places.filter((p) => !s || [p.name, p.city, p.neighborhood, p.cuisine].join(" ").toLowerCase().includes(s)).slice(0, 30);
  }, [db.places, q]);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus /> Add places
        </Button>
      </DialogTrigger>
      <DialogContent title="Add places" description="Search the Peloton catalogue.">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, city or cuisine" className="h-11 w-full rounded-xl border border-paper-300 bg-white pl-10 pr-3 focus:outline-none focus:ring-4 focus:ring-stone/25" />
        </div>
        <ul className="mt-3 space-y-1">
          {results.map((p) => {
            const has = existing.includes(p.id);
            return (
              <li key={p.id}>
                <button onClick={() => actions.toggleInCollection(collectionId, p.id)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-white">
                  <PlaceImage src={p.imageUrl} alt="" category={p.category} className="h-12 w-12 shrink-0 rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{p.name}</span>
                    <span className="block truncate text-[12.5px] text-muted">
                      {p.neighborhood}, {p.city}
                    </span>
                  </span>
                  <span className={cn("rounded-full px-3 py-1 text-[12px] font-medium", has ? "bg-ink text-paper" : "border border-paper-300")}>{has ? "Added" : "Add"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
