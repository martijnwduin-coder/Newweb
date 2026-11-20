"use client";

import { ArrowRight, Loader2, Play, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DealCard, DealRow, DiscountPill } from "@/components/deal-card";
import { PageHeader } from "@/components/shell";
import { NotOperationalBanner, SampleBanner, ScanStatus } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, Skeleton } from "@/components/ui/input";
import { api, useApi } from "@/lib/api";
import { COUNTRY_NAMES, FLAGS, dateTime, money, relTime } from "@/lib/format";
import type { Overview } from "@/lib/types";

function Stat({ label, value, sub, href }: { label: string; value: React.ReactNode; sub?: React.ReactNode; href?: string }) {
  const inner = (
    <div className="h-full rounded-xl border border-border bg-panel p-4 transition-colors hover:border-faint">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1.5 truncate text-2xl font-semibold tracking-tight tabular">{value}</div>
      {sub && <div className="mt-1 truncate text-xs text-muted">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function OverviewView() {
  const { data, error, reload } = useApi<Overview>("/api/overview");
  const [starting, setStarting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const runScan = async () => {
    setStarting(true);
    setMsg(null);
    try {
      const r = await api<{ scan_id?: number; message?: string }>("/api/scans/run", { method: "POST", body: JSON.stringify({}) });
      setMsg(r.message ?? `Scan #${r.scan_id} started. A full scan of five countries takes about an hour; results appear as each country finishes.`);
      setTimeout(reload, 1500);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  };

  if (error) return <Empty title="Could not load the dashboard">{error}</Empty>;
  if (!data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );

  const b = data.biggest_discount;
  const c = data.cheapest_product;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        subtitle={
          <>
            Nike on Zalando · NL · DE · FR · ES · PL
            {data.last_successful_scan && <> · data from {dateTime(data.last_successful_scan.finished_at ?? data.last_successful_scan.started_at)}</>}
          </>
        }
        actions={
          <>
            {data.running_scan ? (
              <Button variant="outline" disabled>
                <Loader2 className="animate-spin" /> Scan #{data.running_scan.id} running
              </Button>
            ) : (
              <Button variant="accent" onClick={runScan} disabled={starting}>
                {starting ? <Loader2 className="animate-spin" /> : <Play />} Run scan now
              </Button>
            )}
          </>
        }
      />
      {msg && <div className="rounded-xl border border-border bg-panel px-4 py-3 text-sm">{msg}</div>}
      {data.sample_mode && <SampleBanner />}
      {!data.operational && !data.sample_mode && <NotOperationalBanner />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Nike products tracked" value={data.products_tracked.toLocaleString()} sub={`${data.listings_tracked.toLocaleString()} country listings`} href="/deals?min=0" />
        <Stat label="Discounted products" value={data.discounted_products.toLocaleString()} sub="10% or more off, in stock" href="/deals" />
        <Stat label="Discounts of 30%+" value={data.discounts_30_plus.toLocaleString()} sub="flagged as strong deals" href="/deals?min=30" />
        <Stat label="New deals this week" value={data.new_deals_this_week.toLocaleString()} sub="newly discounted since last scan" href="/deals?new=1" />
        <Stat
          label="Biggest discount"
          value={b ? `-${Math.round(b.discount_pct)}%` : "–"}
          sub={b ? `${b.model} · ${FLAGS[b.country]} ${b.country} · ${money(b.price, b.currency)}` : "no data yet"}
          href={b ? `/products/${b.product_id}` : undefined}
        />
        <Stat
          label="Cheapest deal"
          value={c ? money(c.price_eur) : "–"}
          sub={c ? `${c.model} · ${FLAGS[c.country]} ${c.country} · -${Math.round(c.discount_pct)}%` : "no data yet"}
          href={c ? `/products/${c.product_id}` : undefined}
        />
        <Stat
          label="Last successful scan"
          value={data.last_successful_scan ? relTime(data.last_successful_scan.finished_at ?? data.last_successful_scan.started_at) : "never"}
          sub={data.last_scan ? <span className="inline-flex items-center gap-1.5">latest: <ScanStatus status={data.last_scan.status} /></span> : "run your first scan"}
          href="/settings#scans"
        />
        <Stat label="Next scheduled scan" value={data.next_scheduled_scan ? relTime(data.next_scheduled_scan) : "–"} sub={dateTime(data.next_scheduled_scan)} href="/settings" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Top deals right now</h2>
            <Link href="/deals?sort=score" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
              All deals <ArrowRight className="size-4" />
            </Link>
          </div>
          {data.top_deals.length ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {data.top_deals.map((d) => (
                <DealCard key={d.variant_id} d={d} />
              ))}
            </div>
          ) : (
            <Empty title="No discounted products yet">Deals appear here after the first successful scan.</Empty>
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Country comparison</CardTitle>
              <Link href="/compare" className="text-xs text-muted hover:text-text">
                Compare SKUs →
              </Link>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular">
                <thead className="text-xs text-muted">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left font-medium">Country</th>
                    <th className="px-2 py-2 text-right font-medium">Deals</th>
                    <th className="px-2 py-2 text-right font-medium">30%+</th>
                    <th className="px-2 py-2 text-right font-medium">Avg off</th>
                    <th className="px-4 py-2 text-right font-medium">Cheapest</th>
                  </tr>
                </thead>
                <tbody>
                  {data.countries.map((r, i) => (
                    <tr key={r.country} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">
                        {FLAGS[r.country]} {COUNTRY_NAMES[r.country]}
                        {i === 0 && r.discounted > 0 && <span className="ml-1.5 text-[10px] font-semibold uppercase text-good">best</span>}
                      </td>
                      <td className="px-2 py-2 text-right">{r.discounted}</td>
                      <td className="px-2 py-2 text-right">{r.strong_deals}</td>
                      <td className="px-2 py-2 text-right">{r.avg_discount}%</td>
                      <td className="px-4 py-2 text-right" title="SKUs for which this country is the cheapest">
                        {r.cheapest_wins}
                      </td>
                    </tr>
                  ))}
                  {!data.countries.length && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted">
                        No data yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <Star className="size-4 text-accent" /> Watchlist alerts
              </CardTitle>
              <Link href="/watchlist" className="text-xs text-muted hover:text-text">
                Manage →
              </Link>
            </CardHeader>
            <CardBody className="py-1">
              {data.watchlist_matches.length ? (
                <div className="divide-y divide-border">
                  {data.watchlist_matches.map((m) => (
                    <div key={`${m.rule_id}-${m.deal.variant_id}`}>
                      <div className="pt-2 text-[11px] font-medium text-accent">{m.rule}</div>
                      <DealRow d={m.deal} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-muted">No watchlist rule is triggered right now.</div>
              )}
            </CardBody>
          </Card>
          {b && (
            <Card>
              <CardHeader>
                <CardTitle>Biggest discount</CardTitle>
                <DiscountPill pct={b.discount_pct} />
              </CardHeader>
              <CardBody className="py-1">
                <DealRow d={b} />
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
