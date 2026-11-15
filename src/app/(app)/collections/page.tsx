"use client";
import { Library, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { CollectionCard } from "@/components/collections/collection-card";
import { CollectionEditor } from "@/components/collections/collection-editor";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionHeader } from "@/components/ui/rail";
import { trustedIds, visibleCollections } from "@/lib/selectors";
import { useStore } from "@/lib/store/store";

export default function CollectionsPage() {
  const { db, meId } = useStore();
  const router = useRouter();
  const mine = db.collections.filter((c) => c.userId === meId).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  const followedIds = new Set(db.collectionFollows.filter((f) => f.userId === meId).map((f) => f.collectionId));
  const visible = visibleCollections(db, meId).filter((c) => c.userId !== meId);
  const followed = visible.filter((c) => followedIds.has(c.id));
  const trusted = trustedIds(db, meId);
  const fromFriends = visible.filter((c) => trusted.has(c.userId) && !followedIds.has(c.id));
  const discover = visible.filter((c) => c.visibility === "public" && !trusted.has(c.userId) && !followedIds.has(c.id));

  const create = (
    <CollectionEditor onCreated={(id) => router.push(`/collections/${id}`)}>
      <Button>
        <Plus /> New collection
      </Button>
    </CollectionEditor>
  );

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-8 lg:pt-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[38px] text-forest sm:text-[48px]">Collections</h1>
          <p className="mt-2 max-w-xl text-[15px] text-muted">Curated lists for every mood, city and occasion — yours and your friends&apos;.</p>
        </div>
        {create}
      </header>

      <section className="mt-10">
        <SectionHeader title="Your collections" />
        {mine.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((c) => (
              <CollectionCard key={c.id} collection={c} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Library} title="Start your first list" body="Date-night spots, best coffee in town, places to try next…" action={create} />
        )}
      </section>

      {followed.length > 0 && (
        <section className="mt-14">
          <SectionHeader title="Following" subtitle="Lists you've followed" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {followed.map((c) => (
              <CollectionCard key={c.id} collection={c} />
            ))}
          </div>
        </section>
      )}

      {fromFriends.length > 0 && (
        <section className="mt-14">
          <SectionHeader title="From your friends" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {fromFriends.map((c) => (
              <CollectionCard key={c.id} collection={c} />
            ))}
          </div>
        </section>
      )}

      {discover.length > 0 && (
        <section className="mt-14">
          <SectionHeader title="Discover public collections" subtitle="From curators across the Peloton community" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {discover.map((c) => (
              <CollectionCard key={c.id} collection={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
