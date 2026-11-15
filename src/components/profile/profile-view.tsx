"use client";
import { Bookmark, Library, Lock, MapPin, MessageSquareQuote, Settings, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CollectionCard } from "@/components/collections/collection-card";
import { PlaceCard } from "@/components/place/place-card";
import { ReviewCard } from "@/components/place/review-card";
import { UserActions } from "@/components/social/user-actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/rail";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { canView, followerIds, friendIds, placeById, profileById, relationship, tasteProfile, visibleCollections } from "@/lib/selectors";
import { useStore } from "@/lib/store/store";
import { CATEGORY_META, timeAgo } from "@/lib/utils";

export function ProfileView({ userId }: { userId: string }) {
  const { db, meId } = useStore();
  const params = useSearchParams();
  const p = profileById(db, userId);
  if (!p) return null;
  const isMe = userId === meId;
  const rel = relationship(db, meId, userId);
  const profileVisible = canView(db, meId, userId, p.privacy.profile);
  const reviewsVisible = canView(db, meId, userId, p.privacy.reviews);
  const savedVisible = canView(db, meId, userId, p.privacy.saved);

  const reviews = reviewsVisible ? db.reviews.filter((r) => r.userId === userId).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)) : [];
  const saved = savedVisible
    ? db.saved
        .filter((s) => s.userId === userId)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .map((s) => placeById(db, s.placeId))
        .filter(Boolean)
    : [];
  const collections = visibleCollections(db, meId, userId);
  const recommends = reviews.filter((r) => r.overall >= 4).sort((a, b) => b.overall - a.overall);
  const received = isMe ? db.recommendations.filter((r) => r.receiverId === meId) : [];
  const taste = tasteProfile(db, userId);
  const friendsCount = friendIds(db, userId).length;
  const followers = followerIds(db, userId).length;
  const tab = params.get("tab") ?? "reviews";

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-6 sm:px-8 lg:pt-12">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <Avatar user={p} size="xl" className="shadow-lift" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="display text-[34px] text-charcoal sm:text-[42px]">{p.fullName}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[14px] text-muted">
                @{p.username}
                {p.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {p.location}
                  </span>
                )}
                {rel === "friends" && <span className="text-ink">· Friends</span>}
              </p>
            </div>
            {isMe ? (
              <Button asChild variant="outline">
                <Link href="/settings">
                  <Settings /> Edit profile & privacy
                </Link>
              </Button>
            ) : (
              <UserActions userId={userId} size="default" />
            )}
          </div>
          {profileVisible && p.bio && <p className="mt-3 max-w-xl text-[15.5px] leading-relaxed text-charcoal/85">{p.bio}</p>}
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
            {[
              ["Friends", friendsCount],
              ["Followers", followers],
              ["Reviews", reviewsVisible ? reviews.length : "–"],
              ["Saved", savedVisible ? saved.length : "–"],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-[12px] text-muted">{k}</dt>
                <dd className="text-[20px] font-semibold tracking-tight">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {!profileVisible ? (
        <div className="mt-12">
          <EmptyState icon={Lock} title="This profile is private" body={`Become friends with ${p.fullName.split(" ")[0]} to see their places.`} action={<UserActions userId={userId} showFollow={false} />} />
        </div>
      ) : (
        <>
          {/* Taste identity */}
          <section className="mt-10 grid gap-6 overflow-hidden rounded-3xl bg-ink p-6 text-paper shadow-lift sm:grid-cols-[1.2fr_1fr] sm:p-8">
            <div>
              <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-stone">
                <Sparkles className="h-3.5 w-3.5 text-accent" /> Taste identity
              </p>
              <h2 className="display mt-3 text-[30px] sm:text-[36px]">{taste.title}</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {taste.traits.length ? (
                  taste.traits.map((t) => (
                    <span key={t} className="rounded-full bg-white/10 px-3 py-1 text-[13px]">
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-[14px] text-paper/70">Rate a few more places and a personality will emerge.</span>
                )}
              </div>
              <div className="mt-6">
                <div className="flex justify-between text-[12px] text-paper/70">
                  <span>Profile strength</span>
                  <span>
                    {taste.reviewCount} {taste.reviewCount === 1 ? "rating" : "ratings"}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(6, taste.progress * 100)}%` }} />
                </div>
              </div>
            </div>
            <div className="space-y-2.5 sm:border-l sm:border-white/10 sm:pl-6">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-stone">Favourite categories</p>
              {taste.topCategories.slice(0, 4).map((c) => {
                const max = taste.topCategories[0].count;
                return (
                  <div key={c.category}>
                    <div className="flex justify-between text-[13.5px]">
                      <span>{CATEGORY_META[c.category].plural}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-stone" style={{ width: `${(c.count / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
              {taste.averageGiven != null && (
                <p className="pt-2 text-[13px] text-paper/70">
                  Average rating given <span className="font-semibold text-paper">{taste.averageGiven.toFixed(1)}★</span>
                  {taste.cities.length > 0 && <> · Eats in {taste.cities.join(", ")}</>}
                </p>
              )}
            </div>
          </section>

          <Tabs defaultValue={tab} className="mt-10">
            <TabsList>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
              <TabsTrigger value="saved">Saved places</TabsTrigger>
              <TabsTrigger value="collections">Collections</TabsTrigger>
              <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            </TabsList>

            <TabsContent value="reviews">
              {!reviewsVisible ? (
                <EmptyState icon={Lock} title="Reviews are private" />
              ) : reviews.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {reviews.map((r) => (
                    <ReviewCard key={r.id} review={r} place={placeById(db, r.placeId)} showPlace />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Star} title="No reviews yet" body={isMe ? "Rate a place you loved to start your taste profile." : undefined} action={isMe ? <Button asChild><Link href="/map">Find a place</Link></Button> : undefined} />
              )}
            </TabsContent>

            <TabsContent value="saved">
              {!savedVisible ? (
                <EmptyState icon={Lock} title="Saved places are private" />
              ) : saved.length ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4">
                  {saved.map((pl) => (
                    <PlaceCard key={pl!.id} place={pl!} wide />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Bookmark} title="Nothing saved yet" />
              )}
            </TabsContent>

            <TabsContent value="collections">
              {collections.length ? (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {collections.map((c) => (
                    <CollectionCard key={c.id} collection={c} />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Library} title="No collections to show" action={isMe ? <Button asChild><Link href="/collections">Create a collection</Link></Button> : undefined} />
              )}
            </TabsContent>

            <TabsContent value="recommendations">
              {isMe && received.length > 0 && (
                <div className="mb-8">
                  <h3 className="mb-3 text-[15px] font-semibold">Sent to you</h3>
                  <div className="space-y-2">
                    {received.map((r) => {
                      const from = profileById(db, r.senderId);
                      const pl = r.placeId ? placeById(db, r.placeId) : null;
                      const col = r.collectionId ? db.collections.find((c) => c.id === r.collectionId) : null;
                      if (!from || (!pl && !col)) return null;
                      return (
                        <Link key={r.id} href={pl ? `/place/${pl.id}` : `/collections/${col!.id}`} className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-soft hover:shadow-lift">
                          <Avatar user={from} size="sm" />
                          <span className="min-w-0 flex-1 text-[14px]">
                            <span className="font-semibold">{from.fullName.split(" ")[0]}</span> sent you <span className="font-semibold">{pl?.name ?? col?.title}</span>
                            <span className="mt-0.5 flex gap-1.5 text-charcoal/80">
                              <MessageSquareQuote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />“{r.message}”
                            </span>
                          </span>
                          <span className="text-[12px] text-muted">{timeAgo(r.createdAt)}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
              <h3 className="mb-3 text-[15px] font-semibold">{isMe ? "Places you recommend" : `${p.fullName.split(" ")[0]} recommends`}</h3>
              {recommends.length ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4">
                  {recommends.map((r) => {
                    const pl = placeById(db, r.placeId);
                    return pl ? <PlaceCard key={r.id} place={pl} wide note={<span className="font-medium text-accent">★ {r.overall.toFixed(1)} {r.recommendedItems[0] ? `· ${r.recommendedItems[0]}` : ""}</span>} /> : null;
                  })}
                </div>
              ) : (
                <EmptyState icon={Sparkles} title="No recommendations yet" body="Places rated 4★ or higher show up here." />
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
