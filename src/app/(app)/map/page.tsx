"use client";
import { Bookmark, ChevronDown, Globe, List, Loader2, LocateFixed, Map as MapIcon, Search, SlidersHorizontal, Star, Users, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DemoMap } from "@/components/map/demo-map";
import type { MapMarker } from "@/components/map/types";
import { PlaceImage } from "@/components/place/place-image";
import { placeSubtitle, PlaceRow } from "@/components/place/place-card";
import { GoogleRating, PelotonRating } from "@/components/place/rating";
import { SaveButton } from "@/components/place/save-button";
import { AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { isGoogleMapsConfigured, isStaticSite } from "@/lib/config";
import { cities, isSaved, placeStats } from "@/lib/selectors";
import { useStore } from "@/lib/store/store";
import type { Category, Place } from "@/lib/types";
import { CATEGORIES, CATEGORY_META, cn, distanceKm, priceLabel } from "@/lib/utils";

const GoogleMapView = dynamic(() => import("@/components/map/google-map").then((m) => m.GoogleMapView), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full rounded-none" />,
});

const RATING_STEPS = [0, 3.5, 4, 4.5];

export default function MapPage() {
  return (
    <Suspense fallback={<div className="skeleton h-dvh w-full" />}>
      <MapExplorer />
    </Suspense>
  );
}

function MapExplorer() {
  const params = useSearchParams();
  const router = useRouter();
  const { db, meId, me, actions } = useStore();

  const [query, setQuery] = useState(params.get("q") ?? "");
  const [cats, setCats] = useState<Category[]>([]);
  const [minRating, setMinRating] = useState(0);
  const [friendsOnly, setFriendsOnly] = useState(params.get("filter") === "friends");
  const [savedOnly, setSavedOnly] = useState(params.get("filter") === "saved");
  const [view, setView] = useState<"map" | "list">("map");
  const [selectedId, setSelectedId] = useState<string | null>(params.get("place"));
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [googleResults, setGoogleResults] = useState<Place[]>([]);
  const [googleState, setGoogleState] = useState<"idle" | "loading" | "unconfigured" | "error">("idle");

  const allCities = cities(db);
  const initialCity = (() => {
    const fromParam = params.get("city");
    if (fromParam && allCities.includes(fromParam)) return fromParam;
    const q = (params.get("q") ?? "").toLowerCase();
    const named = allCities.find((c) => q.includes(c.toLowerCase()));
    if (named) return named;
    const selected = db.places.find((p) => p.id === params.get("place"));
    if (selected) return selected.city;
    return allCities.find((c) => me?.location?.includes(c)) ?? allCities[0] ?? "Amsterdam";
  })();
  const [city, setCity] = useState(initialCity);

  const cityCenter = useMemo(() => {
    const ps = db.places.filter((p) => p.city === city);
    if (!ps.length) return { lat: 52.3676, lng: 4.9041 };
    return { lat: ps.reduce((a, p) => a + p.lat, 0) / ps.length, lng: ps.reduce((a, p) => a + p.lng, 0) / ps.length };
  }, [db.places, city]);

  // Local (Peloton) results
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qNoCity = allCities.reduce((acc, c) => acc.replace(c.toLowerCase(), ""), q).replace(/\b(in|near)\b/g, "").trim();
    return db.places
      .filter((p) => p.city === city)
      .map((p) => ({ p, s: placeStats(db, p.id, meId) }))
      .filter(({ p, s }) => {
        if (cats.length && !cats.includes(p.category)) return false;
        if (minRating && (s.rating ?? 0) < minRating) return false;
        if (friendsOnly && s.recommenders.length === 0 && s.savedByFriends.length === 0) return false;
        if (savedOnly && !isSaved(db, meId, p.id)) return false;
        if (qNoCity) {
          const hay = [p.name, p.cuisine, p.neighborhood, p.city, CATEGORY_META[p.category].label, p.address, p.description, ...s.topTags.map((t) => t.tag), ...s.topItems.map((i) => i.item)]
            .join(" ")
            .toLowerCase();
          if (!qNoCity.split(/\s+/).every((w) => hay.includes(w))) return false;
        }
        return true;
      })
      .sort((a, b) => b.s.recommenders.length - a.s.recommenders.length || (b.s.rating ?? 0) - (a.s.rating ?? 0));
  }, [db, meId, city, cats, minRating, friendsOnly, savedOnly, query, allCities]);

  const searchGoogle = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    if (isStaticSite) return setGoogleState("unconfigured");
    setGoogleState("loading");
    const c = mapCenter ?? userLoc ?? cityCenter;
    try {
      const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}&lat=${c.lat}&lng=${c.lng}`);
      const json = await res.json();
      if (json.configured === false) {
        setGoogleState("unconfigured");
        setGoogleResults([]);
        return;
      }
      if (json.error) throw new Error(json.error);
      // Hide Google results we already have as Peloton places.
      const known = new Set(db.places.map((p) => p.googlePlaceId).filter(Boolean));
      setGoogleResults((json.places as Place[]).filter((p) => !known.has(p.googlePlaceId)));
      setGoogleState("idle");
    } catch (e) {
      setGoogleState("error");
      toast.error(e instanceof Error ? e.message : "Google search failed");
    }
  }, [query, mapCenter, userLoc, cityCenter, db.places]);

  // Pick up a city from the query when the user types e.g. "coffee in Lisbon".
  useEffect(() => {
    const named = allCities.find((c) => query.toLowerCase().includes(c.toLowerCase()));
    if (named && named !== city) setCity(named);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const locate = () => {
    if (!navigator.geolocation) return toast.error("Location isn't available in this browser");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLoc(loc);
        const nearest = allCities
          .map((c) => {
            const p = db.places.find((x) => x.city === c)!;
            return { c, d: distanceKm(loc, p) };
          })
          .sort((a, b) => a.d - b.d)[0];
        if (nearest && nearest.d < 40) {
          setCity(nearest.c);
          toast.success(`Showing places near you in ${nearest.c}`);
        } else toast("No Peloton places near you yet — try a Google search", { icon: "📍" });
      },
      () => toast.error("We couldn't get your location"),
    );
  };

  const markers: MapMarker[] = [
    ...results.map(({ p, s }) => ({
      id: p.id,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      category: p.category,
      rating: s.rating,
      friend: s.recommenders.length > 0,
      saved: isSaved(db, meId, p.id),
    })),
    ...googleResults.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, category: p.category, rating: p.googleRating, external: true })),
  ];

  const selected = db.places.find((p) => p.id === selectedId) ?? googleResults.find((p) => p.id === selectedId) ?? null;
  const center = selected && selected.city !== city && selected.source === "google" ? { lat: selected.lat, lng: selected.lng } : cityCenter;
  const activeFilters = cats.length + (minRating ? 1 : 0) + (friendsOnly ? 1 : 0) + (savedOnly ? 1 : 0);

  const openGoogle = async (p: Place) => {
    const stored = await actions.importPlace(p);
    router.push(`/place/${stored.id}`);
  };

  const filterBar = (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
        <Chip active={friendsOnly} onClick={() => setFriendsOnly((v) => !v)}>
          <Users /> Friends&apos; picks
        </Chip>
        <Chip active={savedOnly} onClick={() => setSavedOnly((v) => !v)}>
          <Bookmark /> Saved
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} active={cats.includes(c)} onClick={() => setCats((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]))}>
            <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_META[c].color }} />
            {CATEGORY_META[c].plural}
          </Chip>
        ))}
      </div>
      <div className={cn("flex items-center gap-2", !showFilters && "max-lg:hidden")}>
        <span className="text-[12px] font-medium text-muted">Peloton rating</span>
        {RATING_STEPS.map((r) => (
          <Chip key={r} active={minRating === r} onClick={() => setMinRating(r)} className="h-8 px-3">
            {r ? (
              <>
                <Star className="fill-current" /> {r}+
              </>
            ) : (
              "Any"
            )}
          </Chip>
        ))}
      </div>
    </div>
  );

  const searchBox = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        searchGoogle();
      }}
      className="relative flex-1"
    >
      <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!e.target.value) setGoogleResults([]);
        }}
        placeholder="Search places, cuisines, neighborhoods…"
        aria-label="Search the map"
        className="h-12 w-full rounded-full border border-paper-300 bg-white pl-11 pr-10 text-[15px] shadow-soft focus:border-stone focus:outline-none focus:ring-4 focus:ring-stone/25"
      />
      {query && (
        <button type="button" onClick={() => (setQuery(""), setGoogleResults([]))} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-paper-200" aria-label="Clear search">
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );

  const list = (
    <div className="space-y-1">
      {results.map(({ p }) => (
        <PlaceRow
          key={p.id}
          place={p}
          active={p.id === selectedId || p.id === hoverId}
          onHover={setHoverId}
          distance={userLoc ? distanceKm(userLoc, p) : null}
          onClick={view === "map" ? () => setSelectedId(p.id) : undefined}
        />
      ))}
      {results.length === 0 && (
        <div className="rounded-2xl border border-dashed border-paper-300 p-6 text-center text-sm text-muted">
          No Peloton places match{query ? ` “${query}”` : ""} in {city}.
          {activeFilters > 0 && (
            <button
              className="mt-2 block w-full font-medium text-ink"
              onClick={() => {
                setCats([]);
                setMinRating(0);
                setFriendsOnly(false);
                setSavedOnly(false);
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Google results — always labelled as external */}
      {query.trim() && (
        <div className="pt-5">
          <div className="mb-2 flex items-center justify-between px-2">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted">
              <Globe className="h-3.5 w-3.5" /> From Google Places
            </p>
            <button onClick={searchGoogle} className="text-[13px] font-medium text-ink hover:underline" disabled={googleState === "loading"}>
              {googleState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : googleResults.length ? "Search this area" : `Search Google for “${query.trim()}”`}
            </button>
          </div>
          {googleState === "unconfigured" && (
            <p className="rounded-2xl bg-white/70 p-4 text-[13px] text-muted">
              Google Places isn&apos;t connected yet. Add <code className="rounded bg-paper-200 px-1">GOOGLE_PLACES_API_KEY</code> to search every venue worldwide.
            </p>
          )}
          {googleResults.map((p) => (
            <button
              key={p.id}
              onClick={() => (view === "map" ? setSelectedId(p.id) : openGoogle(p))}
              className={cn("flex w-full gap-3 rounded-2xl p-2 text-left transition hover:bg-white/70", selectedId === p.id && "bg-white shadow-lift")}
            >
              <PlaceImage src={p.imageUrl} alt={p.name} category={p.category} className="h-16 w-16 shrink-0 rounded-xl" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-semibold">{p.name}</span>
                <span className="block truncate text-[12.5px] text-muted">{p.address}</span>
                <span className="mt-1 flex items-center gap-2">
                  <GoogleRating rating={p.googleRating} count={p.googleRatingCount} />
                  <span className="text-[11px] text-muted">No Peloton reviews yet</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const map = isGoogleMapsConfigured ? (
    <GoogleMapView markers={markers} center={center} selectedId={selectedId} hoverId={hoverId} onSelect={setSelectedId} onCenterChange={setMapCenter} />
  ) : (
    <DemoMap markers={markers} center={center} selectedId={selectedId} hoverId={hoverId} onSelect={setSelectedId} />
  );

  const citySelect = (
    <label className="relative inline-flex items-center">
      <select
        value={city}
        onChange={(e) => {
          setCity(e.target.value);
          setSelectedId(null);
          setGoogleResults([]);
        }}
        className="h-12 appearance-none rounded-full border border-paper-300 bg-white pl-4 pr-9 text-[14px] font-medium shadow-soft focus:outline-none focus:ring-4 focus:ring-stone/25"
        aria-label="City"
      >
        {allCities.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-muted" />
    </label>
  );

  return (
    <div className="fixed inset-x-0 bottom-16 top-0 lg:relative lg:bottom-auto lg:grid lg:h-[calc(100dvh-56px)] lg:grid-cols-[440px_1fr] lg:grid-rows-[minmax(0,1fr)]">
      {/* Sidebar / list */}
      <section className={cn("flex h-full min-h-0 flex-col bg-paper lg:border-r lg:border-paper-300/70", view === "map" ? "max-lg:hidden" : "max-lg:pt-[150px]")}>
        <div className="hidden space-y-4 px-5 pb-4 pt-8 lg:block">
          <div>
            <p className="eyebrow text-muted">Explore</p>
            <h1 className="display mt-0.5 text-[32px]">{city}</h1>
            <p className="text-[14px] text-muted">
              {results.length} Peloton {results.length === 1 ? "place" : "places"}
              {friendsOnly ? " your friends love" : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {searchBox}
            {citySelect}
          </div>
          {filterBar}
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-28 lg:pb-6">{list}</div>
      </section>

      {/* Map */}
      <section className={cn("relative h-full", view === "list" && "max-lg:hidden")}>
        {map}

        <button
          onClick={locate}
          className="absolute right-4 top-4 hidden h-11 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-medium shadow-lift hover:bg-paper lg:inline-flex"
        >
          <LocateFixed className="h-4 w-4" /> Near me
        </button>

        {/* Preview card */}
        {selected && <PreviewCard place={selected} onClose={() => setSelectedId(null)} onOpenGoogle={openGoogle} />}
      </section>

      {/* Mobile overlay controls */}
      <div className="absolute inset-x-0 top-0 z-20 space-y-2.5 bg-gradient-to-b from-paper via-paper/90 to-transparent px-4 pb-6 pt-3 lg:hidden">
        <div className="flex gap-2">
          {searchBox}
          <button onClick={locate} className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-paper-300 bg-white shadow-soft" aria-label="Near me">
            <LocateFixed className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn("relative grid h-12 w-12 shrink-0 place-items-center rounded-full border shadow-soft", showFilters ? "border-ink bg-ink text-paper" : "border-paper-300 bg-white")}
            aria-label="Filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilters > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] font-bold text-white">{activeFilters}</span>}
          </button>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {allCities.map((c) => (
            <Chip key={c} active={c === city} onClick={() => (setCity(c), setSelectedId(null))} className="h-8">
              {c}
            </Chip>
          ))}
        </div>
        {filterBar}
      </div>

      <button
        onClick={() => setView((v) => (v === "map" ? "list" : "map"))}
        className={cn(
          "absolute left-1/2 z-30 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-charcoal px-5 text-[14px] font-medium text-paper shadow-lift transition lg:hidden",
          selected && view === "map" ? "bottom-[200px]" : "bottom-5",
        )}
      >
        {view === "map" ? (
          <>
            <List className="h-4 w-4" /> List · {results.length}
          </>
        ) : (
          <>
            <MapIcon className="h-4 w-4" /> Map
          </>
        )}
      </button>
    </div>
  );
}

function PreviewCard({ place, onClose, onOpenGoogle }: { place: Place; onClose: () => void; onOpenGoogle: (p: Place) => void }) {
  const { db, meId } = useStore();
  const isExternal = place.id.startsWith("g:");
  const stats = placeStats(db, place.id, meId);
  return (
    <div className="absolute inset-x-3 bottom-3 z-20 animate-scale-in overflow-hidden rounded-3xl bg-white shadow-lift sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[380px]">
      <div className="relative h-36 sm:h-44">
        <PlaceImage src={place.imageUrl} alt={place.name} category={place.category} className="h-full w-full" />
        <button onClick={onClose} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow-soft" aria-label="Close preview">
          <X className="h-4 w-4" />
        </button>
        {!isExternal && (
          <div className="absolute left-3 top-3">
            <SaveButton placeId={place.id} />
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[18px] font-semibold tracking-tight">{place.name}</h3>
            <p className="truncate text-[13px] text-muted">
              {place.cuisine ?? CATEGORY_META[place.category].label}
              {priceLabel(place.priceLevel) ? ` · ${priceLabel(place.priceLevel)}` : ""} · {place.address || placeSubtitle(place)}
            </p>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {isExternal ? <span className="text-[12px] text-muted">No Peloton reviews yet</span> : <PelotonRating rating={stats.rating} count={stats.count} />}
          <GoogleRating rating={place.googleRating} count={place.googleRatingCount} />
        </div>
        {stats.recommenders.length > 0 && (
          <p className="mt-2.5 flex items-center gap-2 rounded-xl bg-accent-50/70 px-3 py-2 text-[13px] text-[#A3360D]">
            <AvatarStack users={stats.recommenders} />
            Recommended by {stats.recommenders.map((p) => p.fullName.split(" ")[0]).slice(0, 3).join(", ")}
          </p>
        )}
        <div className="mt-3.5 flex gap-2">
          {isExternal ? (
            <Button className="flex-1" onClick={() => onOpenGoogle(place)}>
              Add to Peloton & view
            </Button>
          ) : (
            <Button asChild className="flex-1">
              <Link href={`/place/${place.id}`}>View details</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
