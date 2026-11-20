"use client";

import { ArrowUpRight, Check, Star } from "lucide-react";
import { useState } from "react";
import { DiscountPill, ProductImage } from "@/components/deal-card";
import { HistoryChart } from "@/components/history-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, Select, Skeleton } from "@/components/ui/input";
import { api, useApi } from "@/lib/api";
import { COUNTRY_NAMES, FLAGS, dateTime, money } from "@/lib/format";
import type { HistoryPoint, HistoryStats, ProductDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

function Claim({ label, value, detail }: { label: string; value: boolean | null | undefined; detail?: string }) {
  if (value === null || value === undefined)
    return (
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted">{label}</span>
        <span className="text-faint" title="Not enough observations yet to make this claim">not enough data</span>
      </div>
    );
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted">{label}</span>
      <span className={cn("font-medium", value ? "text-good" : "text-muted")}>
        {value ? "Yes" : "No"}
        {detail && <span className="ml-1 font-normal text-faint">{detail}</span>}
      </span>
    </div>
  );
}

function StatsCard({ country, s }: { country: string; s: HistoryStats }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center justify-between text-sm font-medium">
        <span>
          {FLAGS[country]} {country}
        </span>
        <span className="text-xs font-normal text-muted">{s.observations} obs.</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs tabular">
        <div>
          <div className="text-muted">Lowest</div>
          <div className="font-semibold">{money(s.lowest_eur)}</div>
        </div>
        <div>
          <div className="text-muted">Average</div>
          <div className="font-semibold">{money(s.average_eur)}</div>
        </div>
        <div>
          <div className="text-muted">Highest</div>
          <div className="font-semibold">{money(s.highest_eur)}</div>
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <Claim label="All-time low (recorded)" value={s.all_time_low} />
        <Claim label="Below 30-day average" value={s.below_30d_avg} detail={s.avg_30d ? `avg ${money(s.avg_30d)}` : undefined} />
        <Claim label="Below 90-day average" value={s.below_90d_avg} detail={s.avg_90d ? `avg ${money(s.avg_90d)}` : undefined} />
      </div>
    </div>
  );
}

export function ProductView({ id }: { id: number }) {
  const p = useApi<ProductDetail>(`/api/products/${id}`, [id]);
  const [country, setCountry] = useState("");
  const [days, setDays] = useState("");
  const qs = new URLSearchParams();
  if (country) qs.set("country", country);
  if (days) qs.set("days", days);
  const h = useApi<{ series: Record<string, HistoryPoint[]> }>(`/api/products/${id}/history?${qs}`, [id, country, days]);
  const [watched, setWatched] = useState(false);

  const watch = async () => {
    await api("/api/watchlist/rules", { method: "POST", body: JSON.stringify({ kind: "product", product_id: id }) });
    setWatched(true);
  };

  if (p.error) return <Empty title="Product not found">{p.error}</Empty>;
  if (!p.data) return <Skeleton className="h-96" />;
  const d = p.data;
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 sm:flex-row">
        <ProductImage src={d.image_url} alt={d.name} className="aspect-[4/5] w-full rounded-xl sm:w-48" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {d.franchise && <Badge tone="accent">{d.franchise.name}</Badge>}
            <Badge>{d.subcategory || d.category}</Badge>
            <Badge>{d.gender}</Badge>
            {d.is_sample && <Badge tone="warn">SAMPLE DATA</Badge>}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{d.model || d.name}</h1>
          <div className="text-sm text-muted">{d.colourway}</div>
          <div className="text-xs text-faint">
            SKU {d.sku ?? "–"} · first seen {dateTime(d.first_seen_at)}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {d.cheapest_country && (
              <Badge tone="good">
                Cheapest: {FLAGS[d.cheapest_country]} {COUNTRY_NAMES[d.cheapest_country]} · {money(d.lowest_price_eur)}
              </Badge>
            )}
            {d.spread_eur ? <Badge>Spread across countries {money(d.spread_eur)} ({d.spread_pct}%)</Badge> : null}
            {d.discount_only_in_some && <Badge tone="accent">Discounted in some countries only</Badge>}
          </div>
          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={watch} disabled={watched}>
              {watched ? <Check /> : <Star />} {watched ? "On your watchlist" : "Watch this product"}
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Country comparison</CardTitle>
          <span className="text-xs text-muted">Shipping and delivery restrictions apply per country shop</span>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm tabular">
            <thead className="text-xs text-muted">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left font-medium">Country</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
                <th className="px-3 py-2 text-right font-medium">Original</th>
                <th className="px-3 py-2 text-right font-medium">Discount</th>
                <th className="px-3 py-2 text-right font-medium">In EUR</th>
                <th className="px-3 py-2 text-left font-medium">Sizes in stock</th>
                <th className="px-4 py-2 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {d.offers.map((o) => (
                <tr key={o.country} className={cn("border-b border-border last:border-0", o.country === d.cheapest_country && "bg-good-soft/40")}>
                  <td className="px-4 py-2.5">
                    {FLAGS[o.country]} {COUNTRY_NAMES[o.country]}
                    {!o.in_stock && <Badge tone="bad" className="ml-2">sold out</Badge>}
                    {o.listed === false && <Badge className="ml-2">no longer listed</Badge>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold">{money(o.price, o.currency)}</td>
                  <td className="px-3 py-2.5 text-right text-muted">{o.original_price ? <span className="line-through">{money(o.original_price, o.currency)}</span> : "–"}</td>
                  <td className="px-3 py-2.5 text-right">{o.discount_pct ? <DiscountPill pct={o.discount_pct} /> : <span className="text-muted">–</span>}</td>
                  <td className="px-3 py-2.5 text-right">{money(o.price_eur)}</td>
                  <td className="max-w-xs px-3 py-2.5 text-xs text-muted">{o.sizes.length ? o.sizes.join(", ") : "–"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <a href={o.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-xs font-medium hover:text-accent">
                      Open <ArrowUpRight className="size-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Price history</CardTitle>
          <div className="flex gap-2">
            <Select value={country} onChange={(e) => setCountry(e.target.value)} className="h-8 w-32 text-xs">
              <option value="">All countries</option>
              {d.offers.map((o) => (
                <option key={o.country} value={o.country}>
                  {o.country}
                </option>
              ))}
            </Select>
            <Select value={days} onChange={(e) => setDays(e.target.value)} className="h-8 w-28 text-xs">
              <option value="">All time</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
            </Select>
          </div>
        </CardHeader>
        <CardBody>{h.data ? <HistoryChart series={h.data.series} /> : <Skeleton className="h-72" />}</CardBody>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Object.entries(d.history_stats).map(([c, s]) => (
          <StatsCard key={c} country={c} s={s} />
        ))}
      </div>
      <p className="text-xs text-faint">
        Historical claims are only made with at least 3 observations over 14+ days (30-day average) or 4 observations over 45+ days (90-day average).
      </p>
    </div>
  );
}
