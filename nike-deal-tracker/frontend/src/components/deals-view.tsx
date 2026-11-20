"use client";

import { Flame, RotateCcw, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DealCard } from "@/components/deal-card";
import { SampleBanner } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Empty, Input, Label, Select, Skeleton } from "@/components/ui/input";
import { useApi } from "@/lib/api";
import { FLAGS } from "@/lib/format";
import type { Deal, FiltersMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

const SORTS = [
  ["score", "Best overall (ranked)"],
  ["discount", "Highest discount"],
  ["price", "Lowest price"],
  ["reduction", "Biggest saving (€)"],
  ["price_drop", "Biggest price drop"],
  ["newest", "Newest deals"],
  ["franchise", "Franchise"],
  ["country", "Country"],
] as const;

const PAGE = 48;

export function DealsView({ group, defaultMinDiscount = "10" }: { group?: string; defaultMinDiscount?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const get = (k: string, d = "") => sp.get(k) ?? d;
  const [q, setQ] = useState(get("q"));
  const [page, setPage] = useState(1);
  const meta = useApi<FiltersMeta>("/api/filters");

  const params = useMemo(() => {
    const p = new URLSearchParams();
    const min = get("min", defaultMinDiscount);
    if (min && min !== "0") p.set("min_discount", min);
    for (const k of ["country", "franchise", "size", "gender", "category", "max_price"] as const) {
      const v = get(k);
      if (v) p.set(k, v);
    }
    if (group) p.set("group", group);
    if (get("q")) p.set("q", get("q"));
    if (get("new")) p.set("new_days", "7");
    p.set("in_stock", get("stock", "1") === "1" ? "true" : "false");
    p.set("discounted", min && min !== "0" ? "true" : "false");
    p.set("sort", get("sort", "score"));
    p.set("page_size", String(PAGE));
    p.set("page", String(page));
    return p.toString();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, group, page]);

  const deals = useApi<{ total: number; items: Deal[]; sample_mode: boolean }>(`/api/deals?${params}`);

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set(k, v);
    else p.delete(k);
    setPage(1);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };
  const toggleCountry = (c: string) => {
    const cur = new Set(get("country").split(",").filter(Boolean));
    if (cur.has(c)) cur.delete(c);
    else cur.add(c);
    set("country", [...cur].join(","));
  };
  useEffect(() => {
    const t = setTimeout(() => {
      if (q !== get("q")) set("q", q);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const franchises = (meta.data?.franchises ?? []).filter((f) => !group || f.group === group);
  const countries = new Set(get("country").split(",").filter(Boolean));
  const activeFilters = ["country", "franchise", "size", "gender", "category", "max_price", "q", "new"].some((k) => get(k)) || get("min", defaultMinDiscount) !== defaultMinDiscount;

  return (
    <div className="space-y-4">
      {deals.data?.sample_mode && <SampleBanner />}
      <div className="rounded-xl border border-border bg-panel p-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
          <div className="col-span-2">
            <Label>Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-faint" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Model, colour or SKU" className="pl-8" />
            </div>
          </div>
          <div>
            <Label>Min. discount</Label>
            <Select value={get("min", defaultMinDiscount)} onChange={(e) => set("min", e.target.value)}>
              <option value="0">Any (incl. full price)</option>
              {[10, 20, 30, 40, 50, 60].map((n) => (
                <option key={n} value={n}>
                  {n}%+
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Franchise</Label>
            <Select value={get("franchise")} onChange={(e) => set("franchise", e.target.value)}>
              <option value="">All</option>
              {franchises.map((f) => (
                <option key={f.slug} value={f.slug}>
                  {f.name} {f.count ? `(${f.count})` : ""}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Size</Label>
            <Select value={get("size")} onChange={(e) => set("size", e.target.value)}>
              <option value="">Any</option>
              {(meta.data?.sizes ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Gender</Label>
            <Select value={get("gender")} onChange={(e) => set("gender", e.target.value)}>
              <option value="">All</option>
              {["men", "women", "kids", "unisex"].map((g) => (
                <option key={g} value={g}>
                  {g[0].toUpperCase() + g.slice(1)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={get("category")} onChange={(e) => set("category", e.target.value)}>
              <option value="">All</option>
              <option value="footwear">Footwear</option>
              <option value="apparel">Apparel</option>
              <option value="accessories">Accessories</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div>
            <Label>Sort by</Label>
            <Select value={get("sort", "score")} onChange={(e) => set("sort", e.target.value)}>
              {SORTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {["NL", "DE", "FR", "ES", "PL"].map((c) => (
            <button
              key={c}
              onClick={() => toggleCountry(c)}
              className={cn(
                "h-8 rounded-lg border px-2.5 text-sm transition-colors",
                countries.has(c) ? "border-text bg-text text-bg" : "border-border text-muted hover:text-text",
              )}
            >
              {FLAGS[c]} {c}
            </button>
          ))}
          <div className="mx-1 h-5 w-px bg-border" />
          <button
            onClick={() => set("new", get("new") ? "" : "1")}
            className={cn("h-8 rounded-lg border px-2.5 text-sm", get("new") ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-text")}
          >
            New this week
          </button>
          <button
            onClick={() => set("stock", get("stock", "1") === "1" ? "0" : "1")}
            className={cn("h-8 rounded-lg border px-2.5 text-sm", get("stock", "1") === "1" ? "border-border text-muted hover:text-text" : "border-warn bg-warn-soft text-warn")}
          >
            {get("stock", "1") === "1" ? "In stock only" : "Including sold out"}
          </button>
          {activeFilters && (
            <Button variant="ghost" size="sm" onClick={() => router.replace(pathname)}>
              <RotateCcw /> Reset
            </Button>
          )}
          <div className="ml-auto text-sm text-muted tabular">{deals.data ? `${deals.data.total.toLocaleString()} results` : ""}</div>
        </div>
      </div>

      {deals.error && <Empty title="Could not load deals">{deals.error}</Empty>}
      {!deals.data && deals.loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/5]" />
          ))}
        </div>
      )}
      {deals.data && deals.data.items.length === 0 && (
        <Empty title="No products match these filters" icon={<Flame className="size-6" />}>
          Try a lower minimum discount or fewer filters. Only prices actually observed on Zalando are shown.
        </Empty>
      )}
      {deals.data && deals.data.items.length > 0 && (
        <>
          <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6", deals.loading && "opacity-60")}>
            {deals.data.items.map((d) => (
              <DealCard key={d.variant_id} d={d} />
            ))}
          </div>
          {deals.data.total > PAGE && (
            <div className="flex items-center justify-center gap-3 pt-2 text-sm text-muted">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { setPage((p) => p - 1); window.scrollTo({ top: 0 }); }}>
                Previous
              </Button>
              <span className="tabular">
                Page {page} of {Math.ceil(deals.data.total / PAGE)}
              </span>
              <Button variant="outline" size="sm" disabled={page * PAGE >= deals.data.total} onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0 }); }}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
