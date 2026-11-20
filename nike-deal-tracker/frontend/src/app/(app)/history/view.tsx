"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ProductImage } from "@/components/deal-card";
import { ProductView } from "@/components/product-view";
import { Empty, Input, Select } from "@/components/ui/input";
import { useApi } from "@/lib/api";
import type { FiltersMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

type Hit = { id: number; sku: string | null; name: string; model: string | null; colourway: string | null; image_url: string | null; franchise: string | null };

export function HistoryView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [franchise, setFranchise] = useState("");
  const selected = Number(sp.get("product")) || null;
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  const meta = useApi<FiltersMeta>("/api/filters");
  const qs = new URLSearchParams({ limit: "40" });
  if (debounced) qs.set("q", debounced);
  if (franchise) qs.set("franchise", franchise);
  const hits = useApi<Hit[]>(`/api/products?${qs}`);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product, colour, SKU" className="pl-8" />
        </div>
        <Select value={franchise} onChange={(e) => setFranchise(e.target.value)}>
          <option value="">All franchises</option>
          {(meta.data?.franchises ?? []).map((f) => (
            <option key={f.slug} value={f.slug}>
              {f.name}
            </option>
          ))}
        </Select>
        <div className="max-h-[70vh] space-y-1 overflow-y-auto rounded-xl border border-border bg-panel p-1.5">
          {(hits.data ?? []).map((h) => (
            <button
              key={h.id}
              onClick={() => router.replace(`${pathname}?product=${h.id}`, { scroll: false })}
              className={cn("flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left", selected === h.id ? "bg-panel-2" : "hover:bg-panel-2/60")}
            >
              <ProductImage src={h.image_url} alt={h.name} className="size-10 shrink-0 rounded-md" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{h.model || h.name}</div>
                <div className="truncate text-xs text-muted">{h.colourway}</div>
              </div>
            </button>
          ))}
          {hits.data && !hits.data.length && <div className="p-4 text-center text-sm text-muted">No products</div>}
        </div>
      </div>
      <div>{selected ? <ProductView id={selected} /> : <Empty title="Select a product">Choose a product on the left to see its price history.</Empty>}</div>
    </div>
  );
}
