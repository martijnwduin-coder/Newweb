"use client";
import { Coffee, Croissant, UtensilsCrossed, Wine } from "lucide-react";
import { useState } from "react";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<Category, typeof Coffee> = { restaurant: UtensilsCrossed, coffee: Coffee, cafe: Coffee, bakery: Croissant, bar: Wine };

/** Photo with a graceful branded fallback when the image is missing or fails to load. */
export function PlaceImage({ src, alt, category = "restaurant", className, sizes }: { src?: string | null; alt: string; category?: Category; className?: string; sizes?: string }) {
  const [failed, setFailed] = useState(false);
  const Icon = ICONS[category];
  if (!src || failed)
    return (
      <div className={cn("grid place-items-center bg-gradient-to-br from-sage-100 via-cream-200 to-terracotta-50 text-forest/40", className)} aria-label={alt}>
        <Icon className="h-1/4 max-h-12 w-1/4 max-w-12" strokeWidth={1.4} />
      </div>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} sizes={sizes} loading="lazy" decoding="async" onError={() => setFailed(true)} className={cn("object-cover", className)} />
  );
}
