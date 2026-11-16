"use client";
import { useParams, useSearchParams } from "next/navigation";

/**
 * Reads a dynamic route segment. On the static (GitHub Pages) build, pages that weren't
 * pre-generated are served from the "_" placeholder with the real value in ?id=.
 */
export function useRouteParam(name: string): string {
  const params = useParams<Record<string, string>>();
  const search = useSearchParams();
  const raw = params[name] ?? "";
  if (raw === "_") return search.get("id") ?? "";
  return decodeURIComponent(raw);
}
