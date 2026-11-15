import { ArrowRight, MapPin, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { isSupabaseConfigured } from "@/lib/config";
import { demoCollectionPlaces, demoCollections, demoPlaces, demoProfiles, demoReviews } from "@/lib/demo/seed";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Public, server-rendered share pages with Open Graph cards.
 * Only shows data that is public (RLS enforces this in live mode).
 */
interface ShareData {
  title: string;
  subtitle: string;
  image: string | null;
  rating: number | null;
  ratingCount: number;
  quote?: { text: string; by: string } | null;
  places?: { name: string; subtitle: string; image: string | null }[];
  appHref: string;
  isDemo: boolean;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

async function load(kind: string, id: string): Promise<ShareData | null> {
  if (!isSupabaseConfigured) {
    if (kind === "place" || kind === "review") {
      const review = kind === "review" ? demoReviews.find((r) => r.id === id) : null;
      const place = demoPlaces.find((p) => p.id === (review?.placeId ?? id));
      if (!place) return null;
      const rs = demoReviews.filter((r) => r.placeId === place.id);
      const by = review ? demoProfiles.find((p) => p.id === review.userId) : null;
      return {
        title: place.name,
        subtitle: [place.cuisine, place.neighborhood, place.city].filter(Boolean).join(" · "),
        image: place.imageUrl ?? null,
        rating: review?.overall ?? avg(rs.map((r) => r.overall)),
        ratingCount: rs.length,
        quote: review && by ? { text: review.text, by: by.fullName } : null,
        appHref: `/place/${place.id}`,
        isDemo: true,
      };
    }
    if (kind === "collection") {
      const c = demoCollections.find((x) => x.id === id && x.visibility === "public");
      if (!c) return null;
      const owner = demoProfiles.find((p) => p.id === c.userId);
      const places = demoCollectionPlaces
        .filter((cp) => cp.collectionId === c.id)
        .sort((a, b) => a.position - b.position)
        .map((cp) => demoPlaces.find((p) => p.id === cp.placeId)!)
        .filter(Boolean);
      return {
        title: c.title,
        subtitle: `${places.length} places · curated by ${owner?.fullName ?? "a Peloton member"}`,
        image: c.coverImage ?? places[0]?.imageUrl ?? null,
        rating: null,
        ratingCount: 0,
        places: places.map((p) => ({ name: p.name, subtitle: `${p.neighborhood}, ${p.city}`, image: p.imageUrl ?? null })),
        appHref: `/collections/${c.id}`,
        isDemo: true,
      };
    }
    return null;
  }

  const sb = await getSupabaseServer();
  if (kind === "place" || kind === "review") {
    let placeId = id;
    let quote: ShareData["quote"] = null;
    let rating: number | null = null;
    if (kind === "review") {
      const { data: r } = await sb.from("reviews").select("place_id, overall_rating, review_text, profiles(full_name)").eq("id", id).maybeSingle();
      if (!r) return null;
      placeId = r.place_id;
      rating = Number(r.overall_rating);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quote = { text: r.review_text, by: (r as any).profiles?.full_name ?? "A Peloton member" };
    }
    const { data: p } = await sb.from("places").select("*").eq("id", placeId).maybeSingle();
    if (!p) return null;
    const { data: rs } = await sb.from("reviews").select("overall_rating").eq("place_id", placeId);
    const ratings = (rs ?? []).map((x) => Number(x.overall_rating));
    return {
      title: p.name,
      subtitle: [p.cuisine, p.neighborhood, p.city].filter(Boolean).join(" · "),
      image: p.image_url,
      rating: rating ?? avg(ratings),
      ratingCount: ratings.length,
      quote,
      appHref: `/place/${p.id}`,
      isDemo: false,
    };
  }
  if (kind === "collection") {
    const { data: c } = await sb.from("collections").select("*, profiles(full_name)").eq("id", id).maybeSingle();
    if (!c) return null;
    const { data: cps } = await sb.from("collection_places").select("position, places(name, neighborhood, city, image_url)").eq("collection_id", id).order("position");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const places = (cps ?? []).map((x: any) => x.places).filter(Boolean);
    return {
      title: c.title,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      subtitle: `${places.length} places · curated by ${(c as any).profiles?.full_name ?? "a Peloton member"}`,
      image: c.cover_image ?? places[0]?.image_url ?? null,
      rating: null,
      ratingCount: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      places: places.map((p: any) => ({ name: p.name, subtitle: [p.neighborhood, p.city].filter(Boolean).join(", "), image: p.image_url })),
      appHref: `/collections/${c.id}`,
      isDemo: false,
    };
  }
  return null;
}

function cardUrl(d: ShareData, format: string) {
  const p = new URLSearchParams({ title: d.title, subtitle: d.subtitle, format });
  if (d.image) p.set("image", d.image);
  if (d.rating != null) p.set("rating", d.rating.toFixed(1));
  return `/api/share-card?${p.toString()}`;
}

export async function generateMetadata({ params }: { params: Promise<{ kind: string; id: string }> }): Promise<Metadata> {
  const { kind, id } = await params;
  const d = await load(kind, decodeURIComponent(id));
  if (!d) return { title: "Not found" };
  return {
    title: d.title,
    description: `${d.subtitle} — shared on Peloton AI`,
    openGraph: { title: `${d.title} · Peloton AI`, description: d.subtitle, images: [{ url: cardUrl(d, "og"), width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [cardUrl(d, "og")] },
  };
}

export default async function SharePage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const d = await load(kind, decodeURIComponent(id));
  if (!d) notFound();

  return (
    <div className="min-h-dvh bg-cream">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link href="/">
          <Logo />
        </Link>
        <Link href={d.appHref} className="rounded-full bg-forest px-4 py-2 text-[13px] font-medium text-cream">
          Open in Peloton
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16">
        <div className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-cream-200 shadow-lift">
          {d.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.image} alt={d.title} className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 to-transparent" />
          <div className="absolute bottom-0 p-6 text-white sm:p-8">
            <p className="flex items-center gap-1.5 text-[14px] text-white/80">
              <MapPin className="h-4 w-4" /> {d.subtitle}
            </p>
            <h1 className="display mt-1 text-[40px] sm:text-[56px]">{d.title}</h1>
          </div>
        </div>
        {d.rating != null && (
          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[15px] font-semibold shadow-soft">
            <Star className="h-4 w-4 fill-terracotta text-terracotta" /> {d.rating.toFixed(1)}
            <span className="font-normal text-muted">
              {d.quote ? "their rating" : `Peloton community · ${d.ratingCount} ${d.ratingCount === 1 ? "review" : "reviews"}`}
            </span>
          </p>
        )}
        {d.quote && (
          <blockquote className="mt-6 rounded-3xl bg-white p-6 text-[18px] leading-relaxed shadow-soft">
            “{d.quote.text}”<footer className="mt-3 text-[14px] text-muted">— {d.quote.by}</footer>
          </blockquote>
        )}
        {d.places && (
          <ol className="mt-8 space-y-3">
            {d.places.map((p, i) => (
              <li key={p.name + i} className="flex items-center gap-4 rounded-2xl bg-white p-3 shadow-soft">
                <span className="w-6 text-center text-xl font-semibold text-sage">{i + 1}</span>
                {p.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" className="h-16 w-16 rounded-xl object-cover" />
                )}
                <span>
                  <span className="block font-semibold">{p.name}</span>
                  <span className="text-[13px] text-muted">{p.subtitle}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-10 rounded-3xl bg-forest p-8 text-cream">
          <p className="display text-[28px]">Good places. Better connections.</p>
          <p className="mt-2 text-cream/70">Peloton AI is where friends share the places worth going to.</p>
          <Link href={d.appHref} className="mt-6 inline-flex items-center gap-2 rounded-full bg-cream px-5 py-3 text-[14px] font-medium text-forest">
            See it on Peloton <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {d.isDemo && <p className="mt-6 text-center text-[12px] text-muted">Demo content — fictional place and sample reviews.</p>}
      </main>
    </div>
  );
}
