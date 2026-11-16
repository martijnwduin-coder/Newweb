"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { basePath, isStaticSite } from "@/lib/config";

// On the static site, a place/collection/profile created after the build has no page of its
// own. Send those addresses to the "_" fallback page with the real id in the query string.
const DYNAMIC = /^\/(place|collections|u)\/([^/]+)\/?$/;

export default function NotFound() {
  const [redirecting, setRedirecting] = useState(isStaticSite);
  useEffect(() => {
    if (!isStaticSite) return;
    const path = window.location.pathname.slice(basePath.length);
    const m = path.match(DYNAMIC);
    if (m && m[2] !== "_") window.location.replace(`${basePath}/${m[1]}/_/?id=${encodeURIComponent(decodeURIComponent(m[2]))}`);
    else setRedirecting(false);
  }, []);
  if (redirecting) return null;
  return (
    <div className="grid min-h-dvh place-items-center bg-paper px-6 text-center">
      <div>
        <p className="text-[14px] text-muted">404</p>
        <h1 className="display mt-2 text-[32px]">We couldn&apos;t find that table.</h1>
        <Link href="/" className="mt-6 inline-flex h-10 items-center rounded-lg bg-ink px-4 text-[14px] font-medium text-white">
          Back to Discover
        </Link>
      </div>
    </div>
  );
}
