"use client";

import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FLAGS, money } from "@/lib/format";
import type { HistoryPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

// fixed order -> fixed colour per country (never re-assigned when a series is missing)
export const COUNTRY_ORDER = ["NL", "DE", "FR", "ES", "PL"];
const COLOR: Record<string, string> = { NL: "var(--chart-1)", DE: "var(--chart-2)", FR: "var(--chart-3)", ES: "var(--chart-4)", PL: "var(--chart-5)" };

type Metric = "price_eur" | "discount_pct";

export function HistoryChart({ series, height = 300 }: { series: Record<string, HistoryPoint[]>; height?: number }) {
  const [metric, setMetric] = useState<Metric>("price_eur");
  const [view, setView] = useState<"chart" | "table">("chart");
  const countries = COUNTRY_ORDER.filter((c) => series[c]?.length);
  const byDay = new Map<string, Record<string, number | string>>();
  for (const c of countries) {
    for (const p of series[c]) {
      const day = p.t.slice(0, 10);
      const row = byDay.get(day) ?? { day };
      row[c] = p[metric];
      byDay.set(day, row);
    }
  }
  const rows = [...byDay.values()].sort((a, b) => String(a.day).localeCompare(String(b.day)));
  const fmt = (v: number) => (metric === "price_eur" ? money(v) : `${Math.round(v)}%`);
  const total = countries.reduce((n, c) => n + series[c].length, 0);

  if (!countries.length) return <div className="py-10 text-center text-sm text-muted">No price observations yet.</div>;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
          {(["price_eur", "discount_pct"] as Metric[]).map((m) => (
            <button key={m} onClick={() => setMetric(m)} className={cn("rounded-md px-2.5 py-1", metric === m ? "bg-panel-2 font-medium" : "text-muted")}>
              {m === "price_eur" ? "Price (EUR)" : "Discount %"}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
          {(["chart", "table"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={cn("rounded-md px-2.5 py-1 capitalize", view === v ? "bg-panel-2 font-medium" : "text-muted")}>
              {v}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted">
          {total} observation{total === 1 ? "" : "s"} · PLN converted at the ECB rate of each scan
        </span>
      </div>
      {view === "chart" ? (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={24} />
              <YAxis
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={64}
                tickFormatter={(v: number) => fmt(v)}
                domain={metric === "price_eur" ? ["auto", "auto"] : [0, 100]}
              />
              <Tooltip
                cursor={{ stroke: "var(--faint)", strokeWidth: 1 }}
                contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--text)" }}
                labelStyle={{ color: "var(--muted)", marginBottom: 4 }}
                formatter={(v: number, name: string) => [fmt(v), `${FLAGS[name] ?? ""} ${name}`]}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} formatter={(v: string) => <span style={{ color: "var(--text)" }}>{FLAGS[v]} {v}</span>} />
              {countries.map((c) => (
                <Line
                  key={c}
                  type="stepAfter"
                  dataKey={c}
                  stroke={COLOR[c]}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2, stroke: "var(--panel)", fill: COLOR[c] }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--panel)" }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-80 overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm tabular">
            <thead className="sticky top-0 bg-panel text-xs text-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                {countries.map((c) => (
                  <th key={c} className="px-3 py-2 text-right font-medium">
                    {FLAGS[c]} {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={String(r.day)} className="border-t border-border">
                  <td className="px-3 py-1.5">{String(r.day)}</td>
                  {countries.map((c) => (
                    <td key={c} className="px-3 py-1.5 text-right">
                      {typeof r[c] === "number" ? fmt(r[c] as number) : "–"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
