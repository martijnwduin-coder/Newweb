import "server-only";
import type { Category, Place } from "../types";

/**
 * Google Places API (New) integration — server-side only so the key never reaches the browser.
 * Requires GOOGLE_PLACES_API_KEY with "Places API (New)" enabled.
 */
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.primaryType",
  "places.types",
  "places.priceLevel",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.regularOpeningHours.weekdayDescriptions",
  "places.photos",
  "places.addressComponents",
  "places.editorialSummary",
].join(",");

export const isGooglePlacesConfigured = () => Boolean(process.env.GOOGLE_PLACES_API_KEY);

const PRICE: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

function toCategory(types: string[] = []): Category {
  if (types.includes("coffee_shop")) return "coffee";
  if (types.includes("bakery")) return "bakery";
  if (types.some((t) => ["bar", "wine_bar", "pub", "night_club", "cocktail_bar"].includes(t))) return "bar";
  if (types.includes("cafe") || types.includes("brunch_restaurant") || types.includes("breakfast_restaurant")) return "cafe";
  return "restaurant";
}

function cuisine(primary?: string) {
  if (!primary || ["restaurant", "food", "point_of_interest", "establishment"].includes(primary)) return null;
  return primary
    .replace(/_restaurant$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapGooglePlace(g: any): Place {
  const comp = (type: string) => g.addressComponents?.find((c: any) => c.types?.includes(type))?.longText ?? null;
  const photo = g.photos?.[0]?.name;
  return {
    id: `g:${g.id}`,
    googlePlaceId: g.id,
    name: g.displayName?.text ?? "Unnamed place",
    address: g.formattedAddress ?? "",
    city: comp("locality") ?? comp("postal_town") ?? "",
    neighborhood: comp("neighborhood") ?? comp("sublocality") ?? null,
    lat: g.location?.latitude,
    lng: g.location?.longitude,
    category: toCategory(g.types),
    cuisine: cuisine(g.primaryType),
    imageUrl: photo ? `/api/places/photo?name=${encodeURIComponent(photo)}` : null,
    website: g.websiteUri ?? null,
    phone: g.nationalPhoneNumber ?? null,
    openingHours: g.regularOpeningHours?.weekdayDescriptions ?? null,
    priceLevel: PRICE[g.priceLevel] ?? null,
    description: g.editorialSummary?.text ?? null,
    createdAt: new Date().toISOString(),
    source: "google",
    googleRating: g.rating ?? null,
    googleRatingCount: g.userRatingCount ?? null,
  };
}

export async function searchGooglePlaces(params: { query: string; lat?: number; lng?: number; radius?: number }) {
  const body: Record<string, unknown> = { textQuery: params.query, pageSize: 20 };
  if (params.lat != null && params.lng != null)
    body.locationBias = { circle: { center: { latitude: params.lat, longitude: params.lng }, radius: params.radius ?? 6000 } };
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Google Places error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return ((json.places ?? []) as any[]).filter((g) => g.location).map(mapGooglePlace);
}
