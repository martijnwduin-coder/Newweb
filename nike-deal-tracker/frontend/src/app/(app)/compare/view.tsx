"use client";

import { ArrowUpRight, Globe2, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DiscountPill, ProductImage } from "@/components/deal-card";
import { SampleBanner } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Empty, Input, Select, Skeleton } from "@/components/ui/input";
import { useApi } from "@/lib/api";
import { FLAGS, money } from "@/lib/format";
import type { Comparison, FiltersMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

const ORDER = ["NL", "DE", "FR", "ES", "PL"];

export function CompareView() {
  const [q, setQ] = useState("");
  const [deb, setDeb] = useState("");
  const [group, setGroup] = useState("");
  const [franchise, setFranchise] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDeb(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const meta = useApi<FiltersMeta>("/api/filters");
  const qs = new URLSearchParams({ limit: "150" });
  if (deb) qs.set("q", deb);
  if (group) qs.set("group", group);
  if (franchise) qs.set("franchise", franchise);
  const data = useApi<{ items: Comparison[]; total: number }>(`/api/compare?${qs}`);
  const sample = data.data?.items.some((i) => i.is_sample);

  return (
    <div className="space-y-4">
      {sample && <SampleBanner />}
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="pl-8" />
        </div>
        <Select value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">All categories</option>
          {(meta.data?.groups ?? []).map((g) => (
            <option key={g.slug} value={g.slug}>
              {g.name}
            </option>
          ))}
        </Select>
        <Select value={franchise} onChange={(e) => setFranchise(e.target.value)}>
          <option value="">All franchises</option>
          {(meta.data?.franchises ?? []).map((f) => (
            <option key={f.slug} value={f.slug}>
              {f.name}
            </option>
          ))}
        </Select>
      </div>
      {!data.data && <Skeleton className="h-96" />}
      {data.data && !data.data.items.length && (
        <Empty title="No product is listed in two or more countries yet" icon={<Globe2 className="size-6" />}>
          Comparisons appear once the same SKU has been observed in at least two countries.
        </Empty>
      )}
      {data.data && data.data.items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-panel">
          <table className="w-full min-w-[980px] text-sm tabular">
            <thead className="text-xs text-muted">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left font-medium">Product</th>
                {ORDER.map((c) => (
                  <th key={c} className="px-3 py-2.5 text-right font-medium">
                    {FLAGS[c]} {c}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right font-medium">Difference</th>
              </tr>
            </thead>
            <tbody>
              {data.data.items.map((it) => {
                const by = Object.fromEntries(it.offers.map((o) => [o.country, o]));
                return (
                  <tr key={it.product_id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      <Link href={`/products/${it.product_id}`} className="flex items-center gap-2.5">
                        <ProductImage src={it.image_url} alt={it.name} className="size-11 shrink-0 rounded-md" />
                        <div className="min-w-0 max-w-[260px]">
                          <div className="truncate font-medium hover:underline">{it.name}</div>
                          <div className="truncate text-xs text-muted">
                            {it.colourway} · {it.sku}
                          </div>
                          {it.discount_only_in_some && (
                            <Badge tone="accent" className="mt-0.5">
                              discounted in some countries only
                            </Badge>
                          )}
                        </div>
                      </Link>
                    </td>
                    {ORDER.map((c) => {
                      const o = by[c];
                      if (!o) return <td key={c} className="px-3 py-2.5 text-right text-faint">—</td>;
                      const best = c === it.cheapest_country;
                      return (
                        <td key={c} className={cn("px-3 py-2.5 text-right align-top", best && "bg-good-soft/50")}>
                          <a href={o.url} target="_blank" rel="noopener noreferrer" className="group inline-flex flex-col items-end">
                            <span className={cn("font-semibold", !o.in_stock && "text-faint line-through")}>{money(o.price_eur)}</span>
                            {o.currency !== "EUR" && <span className="text-[11px] text-muted">{money(o.price, o.currency)}</span>}
                            <span className="mt-0.5 flex items-center gap-1">
                              {o.discount_pct > 0 && <DiscountPill pct={o.discount_pct} className="text-[10px]" />}
                              <ArrowUpRight className="size-3 text-faint group-hover:text-text" />
                            </span>
                            {!o.in_stock && <span className="text-[10px] text-bad">sold out</span>}
                          </a>
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-right">
                      <div className="font-semibold">{money(it.spread_eur)}</div>
                      <div className="text-xs text-muted">{it.spread_pct}%</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-faint">
        The cheapest country is not automatically the best purchase: Zalando country shops generally ship only within their own country, and shipping costs are only
        shown where verified on the product page.
      </p>
    </div>
  );
}
