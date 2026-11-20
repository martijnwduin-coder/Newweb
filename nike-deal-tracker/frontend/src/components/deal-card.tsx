"use client";

import { ArrowUpRight, Star, Truck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { FLAGS, bandColor, money, relTime } from "@/lib/format";
import type { Deal } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DiscountPill({ pct, className }: { pct: number; className?: string }) {
  if (!pct) return null;
  return <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-bold tabular", bandColor(pct), className)}>-{Math.round(pct)}%</span>;
}

export function ProductImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("relative overflow-hidden bg-panel-2", className)}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-xs text-faint">no image</div>
      )}
    </div>
  );
}

export function DealCard({ d }: { d: Deal }) {
  const sizes = d.sizes.slice(0, 8);
  // "new" = the discount started within 7 days AND after we first saw the product (not just a first scan)
  const isNew =
    !!d.discounted_since &&
    Date.now() - new Date(d.discounted_since).getTime() < 7 * 86400e3 &&
    !!d.first_seen_at &&
    new Date(d.discounted_since).getTime() - new Date(d.first_seen_at).getTime() > 3600e3;
  return (
    <div className={cn("group flex flex-col overflow-hidden rounded-xl border bg-panel transition-colors hover:border-faint", d.watched ? "border-accent/50" : "border-border")}>
      <Link href={`/products/${d.product_id}`} className="relative block">
        <ProductImage src={d.image_url} alt={d.name} className="aspect-[4/5] w-full" />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <DiscountPill pct={d.discount_pct} />
          {isNew && <Badge tone="solid">New</Badge>}
          {d.is_sample && <Badge tone="warn">SAMPLE</Badge>}
        </div>
        <div className="absolute right-2 top-2 flex items-center gap-1">
          {d.watched && (
            <span className="grid size-6 place-items-center rounded-md bg-accent text-white" title="On your watchlist">
              <Star className="size-3.5 fill-current" />
            </span>
          )}
          <span className="rounded-md bg-panel/90 px-1.5 py-0.5 text-xs font-medium backdrop-blur">
            {FLAGS[d.country]} {d.country}
          </span>
        </div>
        {!d.in_stock && <div className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-center text-xs text-white">Out of stock</div>}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <div className="truncate text-[11px] font-medium uppercase tracking-wide text-muted">
            {d.franchise?.name ?? (d.subcategory || d.category)}
          </div>
          <Link href={`/products/${d.product_id}`} className="line-clamp-1 text-sm font-semibold hover:underline" title={d.local_name}>
            {d.model || d.name}
          </Link>
          <div className="line-clamp-1 text-xs text-muted" title={d.colourway ?? ""}>
            {d.colourway || "—"}
          </div>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-bold tabular">
            {d.price_varies && <span className="mr-1 text-xs font-normal text-muted">from</span>}
            {money(d.price, d.currency)}
          </span>
          {d.original_price && <span className="text-xs text-muted line-through tabular">{money(d.original_price, d.currency)}</span>}
          {d.currency !== "EUR" && <span className="text-xs text-muted tabular">≈ {money(d.price_eur)}</span>}
        </div>
        {(d.reference_label || d.discount_vs_prior_low_pct !== null) && (
          <div className="text-[11px] leading-snug text-muted">
            {d.reference_label && <span title={d.reference_label}>vs “{d.reference_label.length > 34 ? d.reference_label.slice(0, 32) + "…" : d.reference_label}”</span>}
            {d.discount_vs_prior_low_pct !== null && (
              <span className="block">−{Math.round(d.discount_vs_prior_low_pct)}% vs 30-day low ({money(d.prior_low_price, d.currency)})</span>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          {d.is_cheapest && d.country_count && d.country_count > 1 && (d.savings_vs_highest_eur ?? 0) > 0.009 && <Badge tone="good">Cheapest of {d.country_count}</Badge>}
          {d.price_change_eur !== null && d.price_change_eur < -0.5 && <Badge tone="accent">↓ {money(-d.price_change_eur)}</Badge>}
          {d.shipping?.cost === 0 && (
            <Badge>
              <Truck className="size-3" /> free to {d.shipping.destination}
            </Badge>
          )}
        </div>
        {sizes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {sizes.map((s) => (
              <span key={s} className="rounded border border-border px-1 text-[10px] leading-4 text-muted tabular">
                {s}
              </span>
            ))}
            {d.sizes.length > sizes.length && <span className="text-[10px] leading-4 text-faint">+{d.sizes.length - sizes.length}</span>}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between pt-1 text-[11px] text-faint">
          <span title={d.observed_at}>updated {relTime(d.observed_at)}</span>
          <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium text-text hover:text-accent">
            Zalando {d.country} <ArrowUpRight className="size-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

export function DealRow({ d }: { d: Deal }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <ProductImage src={d.image_url} alt={d.name} className="size-12 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <Link href={`/products/${d.product_id}`} className="block truncate text-sm font-medium hover:underline">
          {d.model || d.name}
        </Link>
        <div className="truncate text-xs text-muted">
          {FLAGS[d.country]} {d.country} · {d.colourway}
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold tabular">{money(d.price, d.currency)}</div>
        {d.original_price && <div className="text-xs text-muted line-through tabular">{money(d.original_price, d.currency)}</div>}
      </div>
      <DiscountPill pct={d.discount_pct} />
    </div>
  );
}
