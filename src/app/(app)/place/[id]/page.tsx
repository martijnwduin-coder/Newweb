import { Suspense } from "react";
import { demoPlaces } from "@/lib/demo/seed";
import PlacePageClient from "./client";

// Pre-generate demo pages (needed for the static GitHub Pages build) plus a "_" fallback
// page that serves anything created later, reading the real value from ?id=.
export function generateStaticParams() {
  return [...demoPlaces.map((p) => ({ id: p.id })), { id: "_" }];
}

export default function PlacePage() {
  return (
    <Suspense>
      <PlacePageClient />
    </Suspense>
  );
}
