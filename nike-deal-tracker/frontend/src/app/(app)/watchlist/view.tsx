"use client";

import { Bell, Eye, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { DealRow } from "@/components/deal-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, Input, Label, Select, Skeleton } from "@/components/ui/input";
import { api, useApi } from "@/lib/api";
import type { Deal, FiltersMeta, Rule } from "@/lib/types";

type Form = {
  kind: "franchise" | "colourway" | "product";
  franchise_slug: string;
  colourway: string;
  product_id: string;
  size: string;
  country_code: string;
  min_discount: string;
  max_price_eur: string;
  label: string;
};
const EMPTY: Form = { kind: "franchise", franchise_slug: "air-force-1", colourway: "", product_id: "", size: "", country_code: "", min_discount: "", max_price_eur: "", label: "" };

const PRESETS: { label: string; f: Partial<Form> }[] = [
  { label: "Any Air Force 1 at 40% off", f: { kind: "franchise", franchise_slug: "air-force-1", min_discount: "40" } },
  { label: "Track all Air Max 90", f: { kind: "franchise", franchise_slug: "air-max-90" } },
  { label: "Shox TL below €80", f: { kind: "franchise", franchise_slug: "shox-tl", max_price_eur: "80" } },
  { label: "Vomero Plus in size 44", f: { kind: "franchise", franchise_slug: "vomero-plus", size: "44" } },
  { label: "Metcon 10 at 30% off", f: { kind: "franchise", franchise_slug: "metcon-10", min_discount: "30" } },
];

export function WatchlistView() {
  const wl = useApi<{ rules: Rule[]; matches: { rule_id: number; rule: string; deal: Deal }[] }>("/api/watchlist");
  const meta = useApi<FiltersMeta>("/api/filters");
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [productQ, setProductQ] = useState("");
  const products = useApi<{ id: number; name: string; colourway: string | null }[]>(
    form.kind === "product" && productQ.length >= 2 ? `/api/products?q=${encodeURIComponent(productQ)}&limit=15` : null,
    [productQ, form.kind],
  );
  const up = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (f: Form) => {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/watchlist/rules", {
        method: "POST",
        body: JSON.stringify({
          kind: f.kind,
          franchise_slug: f.kind !== "product" && f.franchise_slug ? f.franchise_slug : null,
          colourway: f.kind === "colourway" ? f.colourway : null,
          product_id: f.kind === "product" ? Number(f.product_id) || null : null,
          size: f.size || null,
          country_code: f.country_code || null,
          min_discount: f.min_discount ? Number(f.min_discount) : null,
          max_price_eur: f.max_price_eur ? Number(f.max_price_eur) : null,
          label: f.label || null,
        }),
      });
      setForm(EMPTY);
      wl.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: number) => {
    await api(`/api/watchlist/rules/${id}`, { method: "DELETE" });
    wl.reload();
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Add a rule</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button key={p.label} onClick={() => save({ ...EMPTY, ...p.f, label: p.label })} className="rounded-lg border border-border px-2 py-1 text-xs text-muted hover:text-text">
                  + {p.label}
                </button>
              ))}
            </div>
            <div className="h-px bg-border" />
            <div>
              <Label>What to follow</Label>
              <Select value={form.kind} onChange={(e) => up("kind", e.target.value)}>
                <option value="franchise">An entire franchise</option>
                <option value="colourway">A colourway (optionally within a franchise)</option>
                <option value="product">One specific product</option>
              </Select>
            </div>
            {form.kind !== "product" && (
              <div>
                <Label>Franchise</Label>
                <Select value={form.franchise_slug} onChange={(e) => up("franchise_slug", e.target.value)}>
                  {form.kind === "colourway" && <option value="">Any franchise</option>}
                  {(meta.data?.franchises ?? []).map((f) => (
                    <option key={f.slug} value={f.slug}>
                      {f.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {form.kind === "colourway" && (
              <div>
                <Label>Colourway contains</Label>
                <Input value={form.colourway} onChange={(e) => up("colourway", e.target.value)} placeholder="e.g. white, panda, triple black" />
              </div>
            )}
            {form.kind === "product" && (
              <div>
                <Label>Product</Label>
                <Input value={productQ} onChange={(e) => setProductQ(e.target.value)} placeholder="Search by name or SKU" />
                {products.data && (
                  <Select className="mt-2" value={form.product_id} onChange={(e) => up("product_id", e.target.value)}>
                    <option value="">Select…</option>
                    {products.data.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.colourway}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Size (optional)</Label>
                <Input value={form.size} onChange={(e) => up("size", e.target.value)} placeholder="44" />
              </div>
              <div>
                <Label>Country (optional)</Label>
                <Select value={form.country_code} onChange={(e) => up("country_code", e.target.value)}>
                  <option value="">All five</option>
                  {["NL", "DE", "FR", "ES", "PL"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Alert at discount ≥ (%)</Label>
                <Input type="number" min={1} max={95} value={form.min_discount} onChange={(e) => up("min_discount", e.target.value)} placeholder="40" />
              </div>
              <div>
                <Label>Alert below (€)</Label>
                <Input type="number" min={1} value={form.max_price_eur} onChange={(e) => up("max_price_eur", e.target.value)} placeholder="80" />
              </div>
            </div>
            <div>
              <Label>Name (optional)</Label>
              <Input value={form.label} onChange={(e) => up("label", e.target.value)} placeholder="e.g. Summer AF1s" />
            </div>
            <p className="text-xs text-muted">Without a threshold the rule only tracks (highlights) products. With one, matching in-stock products become alerts.</p>
            {err && <div className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{err}</div>}
            <Button onClick={() => save(form)} disabled={busy} className="w-full">
              {busy ? <Loader2 className="animate-spin" /> : <Plus />} Add rule
            </Button>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Your rules</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {!wl.data && <Skeleton className="h-24" />}
            {wl.data && !wl.data.rules.length && <div className="py-4 text-center text-sm text-muted">No rules yet.</div>}
            {wl.data?.rules.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{r.label || r.description}</div>
                  {r.label && <div className="text-xs text-muted">{r.description}</div>}
                  <div className="mt-1.5 flex gap-1.5">
                    <Badge>
                      <Eye className="size-3" /> {r.tracked} tracked
                    </Badge>
                    {(r.min_discount !== null || r.max_price_eur !== null) && (
                      <Badge tone={r.triggered ? "accent" : "neutral"}>
                        <Bell className="size-3" /> {r.triggered} alerts
                      </Badge>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(r.id)} aria-label="Delete rule">
                  <Trash2 />
                </Button>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Current alerts</CardTitle>
          <span className="text-xs text-muted">{wl.data?.matches.length ?? 0} matches</span>
        </CardHeader>
        <CardBody className="py-1">
          {wl.data && !wl.data.matches.length && (
            <Empty title="No alerts right now" icon={<Bell className="size-6" />}>
              When a product hits one of your thresholds it shows up here and in the Monday report.
            </Empty>
          )}
          <div className="divide-y divide-border">
            {wl.data?.matches.map((m) => (
              <div key={`${m.rule_id}-${m.deal.variant_id}`}>
                <div className="pt-2.5 text-[11px] font-medium text-accent">{m.rule}</div>
                <DealRow d={m.deal} />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
