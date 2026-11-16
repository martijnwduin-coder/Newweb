import { Suspense } from "react";
import { demoCollections } from "@/lib/demo/seed";
import CollectionPageClient from "./client";

// Pre-generate demo pages (needed for the static GitHub Pages build) plus a "_" fallback
// page that serves anything created later, reading the real value from ?id=.
export function generateStaticParams() {
  return [...demoCollections.map((c) => ({ id: c.id })), { id: "_" }];
}

export default function CollectionPage() {
  return (
    <Suspense>
      <CollectionPageClient />
    </Suspense>
  );
}
