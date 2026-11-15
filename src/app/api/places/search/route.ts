import { NextResponse } from "next/server";
import { isGooglePlacesConfigured, searchGooglePlaces } from "@/lib/places/google";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400 });
  if (!isGooglePlacesConfigured()) return NextResponse.json({ configured: false, places: [] });
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  try {
    const places = await searchGooglePlaces({
      query: q.slice(0, 200),
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
    });
    return NextResponse.json({ configured: true, places });
  } catch (e) {
    return NextResponse.json({ configured: true, places: [], error: e instanceof Error ? e.message : "Search failed" }, { status: 502 });
  }
}
