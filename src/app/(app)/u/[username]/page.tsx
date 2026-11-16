import { Suspense } from "react";
import { demoProfiles } from "@/lib/demo/seed";
import UserPageClient from "./client";

// Pre-generate demo pages (needed for the static GitHub Pages build) plus a "_" fallback
// page that serves anything created later, reading the real value from ?id=.
export function generateStaticParams() {
  return [...demoProfiles.map((p) => ({ username: p.username })), { username: "_" }];
}

export default function UserPage() {
  return (
    <Suspense>
      <UserPageClient />
    </Suspense>
  );
}
