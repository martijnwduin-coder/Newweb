"use client";

import { ChevronDown, ChevronRight, ExternalLink, Loader2, Mail, Play, Plus, RefreshCw, Save } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { ScanStatus } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Skeleton } from "@/components/ui/input";
import { api, useApi } from "@/lib/api";
import { FLAGS, dateTime, relTime } from "@/lib/format";
import type { Scan } from "@/lib/types";

type SettingsData = {
  report_email: string | null;
  report_enabled: boolean;
  schedule_weekday: number;
  schedule_hour: number;
  schedule_minute: number;
  timezone: string;
  report_min_discount: number;
  flag_discount: number;
  notify_on_failure: boolean;
  next_run: string;
  scheduler_status: string;
  system: {
    email_provider: string;
    email_configured: boolean;
    email_from: string;
    scan_executor: string;
    github_dispatch_configured: boolean;
    inprocess_scheduler: boolean;
    connectors: string[];
    http_min_delay_seconds: number;
    environment: string;
  };
};
type CountryRow = { code: string; name: string; domain: string; currency: string; enabled: boolean; connector: string; connector_override: string | null; nike_path: string; feed_configured: boolean };
type FranchiseRow = { id: number; slug: string; name: string; group: string; priority: number; patterns: string[]; active: boolean; is_custom: boolean };
type ReportRow = { id: number; kind: string; recipient: string; subject: string; status: string; attempts: number; error: string | null; created_at: string; sent_at: string | null };

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function Section({ id, title, children, actions }: { id: string; title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {actions}
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--accent)]" />
      {label}
    </label>
  );
}

function ScheduleSection() {
  const s = useApi<SettingsData>("/api/settings");
  const [form, setForm] = useState<SettingsData | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (s.data) setForm(s.data);
  }, [s.data]);
  if (!form) return <Skeleton className="h-64" />;
  const up = <K extends keyof SettingsData>(k: K, v: SettingsData[K]) => setForm({ ...form, [k]: v });
  const save = async () => {
    setBusy("save");
    setMsg(null);
    try {
      const r = await api<SettingsData>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          report_email: form.report_email || null,
          report_enabled: form.report_enabled,
          schedule_weekday: form.schedule_weekday,
          schedule_hour: form.schedule_hour,
          schedule_minute: form.schedule_minute,
          timezone: form.timezone,
          report_min_discount: form.report_min_discount,
          notify_on_failure: form.notify_on_failure,
        }),
      });
      s.setData(r);
      setMsg("Saved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };
  const test = async () => {
    setBusy("test");
    setMsg(null);
    try {
      const r = await api<{ status: string; error: string | null; recipient: string }>("/api/reports/send-test", { method: "POST" });
      setMsg(r.status === "sent" ? `Test report sent to ${r.recipient}.` : `Not sent (${r.status}): ${r.error}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };
  const sys = form.system;
  return (
    <Section id="schedule" title="Weekly scan & email report">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3 sm:col-span-1">
              <Label>Day</Label>
              <Select value={form.schedule_weekday} onChange={(e) => up("schedule_weekday", Number(e.target.value))}>
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Hour</Label>
              <Select value={form.schedule_hour} onChange={(e) => up("schedule_hour", Number(e.target.value))}>
                {Array.from({ length: 24 }).map((_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Minute</Label>
              <Select value={form.schedule_minute} onChange={(e) => up("schedule_minute", Number(e.target.value))}>
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label>Time zone</Label>
            <Input value={form.timezone} onChange={(e) => up("timezone", e.target.value)} />
          </div>
          <div className="rounded-lg bg-panel-2 px-3 py-2 text-xs text-muted">
            Next run: <b className="text-text">{dateTime(form.next_run)}</b> ({relTime(form.next_run)})<br />
            {form.scheduler_status}
          </div>
          {form.schedule_weekday !== 0 && !sys.inprocess_scheduler && (
            <div className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
              The GitHub Actions workflow only wakes up on Mondays by default. If you pick another day, change the day-of-week field in{" "}
              <code>.github/workflows/nike-weekly-scan.yml</code> to <code>*</code>.
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <Label>Send the report to</Label>
            <Input type="email" value={form.report_email ?? ""} onChange={(e) => up("report_email", e.target.value)} />
          </div>
          <div>
            <Label>Top-20 minimum discount</Label>
            <Select value={form.report_min_discount} onChange={(e) => up("report_min_discount", Number(e.target.value))}>
              {[10, 15, 20, 25, 30, 40].map((n) => (
                <option key={n} value={n}>
                  {n}%
                </option>
              ))}
            </Select>
          </div>
          <Toggle checked={form.report_enabled} onChange={(v) => up("report_enabled", v)} label="Send the weekly email report" />
          <Toggle checked={form.notify_on_failure} onChange={(v) => up("notify_on_failure", v)} label="Email me when a scan fails or is partial" />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            Email provider: <Badge tone={sys.email_configured ? "good" : "warn"}>{sys.email_provider}{sys.email_configured ? " · configured" : " · not configured"}</Badge>
            <span className="text-muted">from {sys.email_from}</span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button onClick={save} disabled={!!busy}>
          {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} Save
        </Button>
        <Button variant="outline" onClick={test} disabled={!!busy}>
          {busy === "test" ? <Loader2 className="animate-spin" /> : <Mail />} Send test report
        </Button>
        <Button variant="ghost" asChild>
          <a href="/api/backend/api/reports/preview" target="_blank" rel="noopener">
            <ExternalLink /> Preview report
          </a>
        </Button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </Section>
  );
}

function ScansSection() {
  const scans = useApi<Scan[]>("/api/scans?limit=25");
  const [open, setOpen] = useState<number | null>(null);
  const [countries, setCountries] = useState<string[]>([]);
  const [report, setReport] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const running = scans.data?.some((s) => s.status === "running");
  useEffect(() => {
    if (!running) return;
    const t = setInterval(scans.reload, 5000);
    return () => clearInterval(t);
  }, [running, scans.reload]);
  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ scan_id?: number; message?: string }>("/api/scans/run", {
        method: "POST",
        body: JSON.stringify({ countries: countries.length ? countries : null, send_report: report }),
      });
      setMsg(r.message ?? `Scan #${r.scan_id} started.`);
      scans.reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section
      id="scans"
      title="Scans"
      actions={
        <Button variant="ghost" size="sm" onClick={scans.reload}>
          <RefreshCw /> Refresh
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {["NL", "DE", "FR", "ES", "PL"].map((c) => (
          <label key={c} className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-sm">
            <input type="checkbox" checked={countries.includes(c)} onChange={(e) => setCountries(e.target.checked ? [...countries, c] : countries.filter((x) => x !== c))} />
            {FLAGS[c]} {c}
          </label>
        ))}
        <span className="text-xs text-muted">(none = all)</span>
        <Toggle checked={report} onChange={setReport} label="email report afterwards" />
        <Button variant="accent" onClick={run} disabled={busy || running}>
          {busy || running ? <Loader2 className="animate-spin" /> : <Play />} {running ? "Scan running…" : "Run scan now"}
        </Button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
      {!scans.data ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm tabular">
            <thead className="text-xs text-muted">
              <tr className="border-b border-border">
                <th className="w-6" />
                <th className="px-2 py-2 text-left font-medium">Scan</th>
                <th className="px-2 py-2 text-left font-medium">Started</th>
                <th className="px-2 py-2 text-left font-medium">Duration</th>
                <th className="px-2 py-2 text-left font-medium">Status</th>
                <th className="px-2 py-2 text-left font-medium">Countries</th>
                <th className="px-2 py-2 text-right font-medium">Products</th>
                <th className="px-2 py-2 text-right font-medium">New deals</th>
              </tr>
            </thead>
            <tbody>
              {scans.data.map((s) => {
                const dur = s.finished_at ? Math.round((new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()) / 60000) : null;
                return (
                  <Fragment key={s.id}>
                    <tr className="cursor-pointer border-b border-border hover:bg-panel-2/50" onClick={() => setOpen(open === s.id ? null : s.id)}>
                      <td className="pl-2 text-muted">{open === s.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</td>
                      <td className="px-2 py-2">
                        #{s.id} <span className="text-xs text-muted">{s.trigger}</span> {s.is_sample && <Badge tone="warn">sample</Badge>}
                      </td>
                      <td className="px-2 py-2">{dateTime(s.started_at)}</td>
                      <td className="px-2 py-2">{dur === null ? "…" : `${dur} min`}</td>
                      <td className="px-2 py-2">
                        <ScanStatus status={s.status} />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex gap-1">
                          {s.countries.map((c) => (
                            <span key={c.country} title={`${c.country}: ${c.status}`} className="text-xs">
                              {c.country}
                              <span className={c.status === "success" ? "text-good" : c.status === "partial" || c.status === "running" ? "text-warn" : "text-bad"}>●</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">{s.products_updated}</td>
                      <td className="px-2 py-2 text-right">{s.new_discounts}</td>
                    </tr>
                    {open === s.id && (
                      <tr className="border-b border-border bg-panel-2/40">
                        <td colSpan={8} className="px-4 py-3">
                          {s.error && <div className="mb-2 text-xs text-bad">{s.error}</div>}
                          <table className="w-full text-xs">
                            <thead className="text-muted">
                              <tr>
                                <th className="py-1 text-left font-medium">Country</th>
                                <th className="py-1 text-left font-medium">Connector</th>
                                <th className="py-1 text-left font-medium">Status</th>
                                <th className="py-1 text-right font-medium">Requests</th>
                                <th className="py-1 text-right font-medium">Found</th>
                                <th className="py-1 text-right font-medium">Updated</th>
                                <th className="py-1 text-right font-medium">New</th>
                                <th className="py-1 text-right font-medium">New deals</th>
                                <th className="py-1 text-right font-medium">Rejected</th>
                                <th className="py-1 pl-4 text-left font-medium">Errors</th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.countries.map((c) => (
                                <tr key={c.country} className="border-t border-border align-top">
                                  <td className="py-1.5">
                                    {FLAGS[c.country]} {c.country}
                                  </td>
                                  <td className="py-1.5">{c.connector}</td>
                                  <td className="py-1.5">
                                    <ScanStatus status={c.status} />
                                  </td>
                                  <td className="py-1.5 text-right">{c.requests}</td>
                                  <td className="py-1.5 text-right">{c.products_found}</td>
                                  <td className="py-1.5 text-right">{c.products_updated}</td>
                                  <td className="py-1.5 text-right">{c.new_products}</td>
                                  <td className="py-1.5 text-right">{c.new_discounts}</td>
                                  <td className="py-1.5 text-right">{c.rejected}</td>
                                  <td className="max-w-md break-words py-1.5 pl-4 font-mono text-[11px] text-muted">{c.errors.slice(0, 3).join(" · ") || "–"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!scans.data.length && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted">
                    No scans yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function CountriesSection() {
  const c = useApi<CountryRow[]>("/api/countries");
  const patch = async (code: string, body: Partial<CountryRow>) => {
    await api(`/api/countries/${code}`, { method: "PATCH", body: JSON.stringify(body) });
    c.reload();
  };
  return (
    <Section id="countries" title="Country connectors">
      <p className="mb-3 text-xs text-muted">
        Each country is scanned independently. <b>zalando_web</b> reads public Zalando pages (robots.txt respected, ≥4 s between requests, stops on any block).{" "}
        <b>feed</b> uses an authorised affiliate product feed (set <code>FEED_URL_XX</code> on the backend).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-xs text-muted">
            <tr className="border-b border-border">
              <th className="py-2 text-left font-medium">Country</th>
              <th className="py-2 text-left font-medium">Enabled</th>
              <th className="py-2 text-left font-medium">Connector</th>
              <th className="py-2 text-left font-medium">Catalogue path</th>
              <th className="py-2 text-left font-medium">Feed</th>
            </tr>
          </thead>
          <tbody>
            {(c.data ?? []).map((r) => (
              <tr key={r.code} className="border-b border-border last:border-0">
                <td className="py-2">
                  {FLAGS[r.code]} {r.name} <span className="text-xs text-muted">{r.domain} · {r.currency}</span>
                </td>
                <td className="py-2">
                  <input type="checkbox" checked={r.enabled} onChange={(e) => patch(r.code, { enabled: e.target.checked })} />
                </td>
                <td className="py-2">
                  <Select className="h-8 w-36 text-xs" value={r.connector_override ?? ""} onChange={(e) => patch(r.code, { connector: e.target.value } as Partial<CountryRow>)}>
                    <option value="">default ({r.connector})</option>
                    <option value="zalando_web">zalando_web</option>
                    <option value="feed">feed</option>
                    <option value="disabled">disabled</option>
                  </Select>
                </td>
                <td className="py-2 font-mono text-xs">{r.nike_path}</td>
                <td className="py-2">{r.feed_configured ? <Badge tone="good">configured</Badge> : <Badge>not set</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function FranchiseSection() {
  const f = useApi<FranchiseRow[]>("/api/franchises");
  const [name, setName] = useState("");
  const [pattern, setPattern] = useState("");
  const [group, setGroup] = useState("other");
  const [msg, setMsg] = useState<string | null>(null);
  const add = async () => {
    setMsg(null);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const pat = pattern || `\\b${name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}\\b`;
    try {
      await api("/api/franchises", { method: "POST", body: JSON.stringify({ name, slug, group, priority: 2, patterns: [pat] }) });
      const r = await api<{ changed: number }>("/api/franchises/reclassify", { method: "POST" });
      setMsg(`Added. ${r.changed} existing products re-classified.`);
      setName("");
      setPattern("");
      f.reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };
  const toggle = async (row: FranchiseRow) => {
    await api(`/api/franchises/${row.id}`, { method: "PATCH", body: JSON.stringify({ active: !row.active }) });
    f.reload();
  };
  return (
    <Section id="franchises" title="Franchises">
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_160px_auto]">
        <Input placeholder="Name, e.g. Air Superfly" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Regex (optional), e.g. \bair superfly\b" value={pattern} onChange={(e) => setPattern(e.target.value)} className="font-mono text-xs" />
        <Select value={group} onChange={(e) => setGroup(e.target.value)}>
          {["air-force-1", "air-max", "running", "basketball", "training", "other"].map((g) => (
            <option key={g}>{g}</option>
          ))}
        </Select>
        <Button onClick={add} disabled={name.length < 2}>
          <Plus /> Add
        </Button>
      </div>
      {msg && <div className="mb-3 text-sm text-muted">{msg}</div>}
      <div className="flex flex-wrap gap-1.5">
        {(f.data ?? []).map((r) => (
          <button
            key={r.id}
            onClick={() => toggle(r)}
            title={`${r.patterns.join("  |  ")} — click to ${r.active ? "disable" : "enable"}`}
            className={`rounded-lg border px-2 py-1 text-xs ${r.active ? "border-border" : "border-dashed border-border text-faint line-through"}`}
          >
            {r.priority === 1 && <span className="mr-1 text-accent">★</span>}
            {r.name}
            {r.is_custom && <span className="ml-1 text-muted">(custom)</span>}
          </button>
        ))}
      </div>
    </Section>
  );
}

function ReportsSection() {
  const r = useApi<ReportRow[]>("/api/reports?limit=15");
  const fx = useApi<{ date: string; quote: string; rate: number; source: string }[]>("/api/exchange-rates");
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Section id="emails" title="Email delivery log">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-border">
                <th className="py-2 text-left font-medium">When</th>
                <th className="py-2 text-left font-medium">Type</th>
                <th className="py-2 text-left font-medium">To</th>
                <th className="py-2 text-left font-medium">Status</th>
                <th className="py-2 text-left font-medium" />
              </tr>
            </thead>
            <tbody>
              {(r.data ?? []).map((x) => (
                <tr key={x.id} className="border-b border-border last:border-0 align-top">
                  <td className="py-2">{dateTime(x.created_at)}</td>
                  <td className="py-2">{x.kind}</td>
                  <td className="py-2 text-xs">{x.recipient}</td>
                  <td className="py-2">
                    <ScanStatus status={x.status} /> {x.attempts > 1 && <span className="text-xs text-muted">{x.attempts} attempts</span>}
                    {x.error && <div className="mt-1 max-w-xs text-xs text-muted">{x.error}</div>}
                  </td>
                  <td className="py-2 text-right">
                    <a className="text-xs underline" href={`/api/backend/api/reports/${x.id}/html`} target="_blank" rel="noopener">
                      view
                    </a>
                  </td>
                </tr>
              ))}
              {r.data && !r.data.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted">
                    No emails yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
      <Section id="fx" title="Exchange rates (ECB)">
        <div className="space-y-1 text-sm tabular">
          {(fx.data ?? []).slice(0, 8).map((x) => (
            <div key={x.date} className="flex justify-between">
              <span className="text-muted">{x.date}</span>
              <span>
                1 EUR = {x.rate.toFixed(4)} {x.quote}
              </span>
            </div>
          ))}
          {fx.data && !fx.data.length && <div className="text-muted">No rates fetched yet (fetched at the start of each scan).</div>}
        </div>
      </Section>
    </div>
  );
}

function AccountSection() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const change = async () => {
    try {
      await api("/api/auth/change-password", { method: "POST", body: JSON.stringify({ current_password: cur, new_password: next }) });
      setMsg("Password changed.");
      setCur("");
      setNext("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Section id="account" title="Account">
      <div className="grid max-w-xl gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input type="password" placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
        <Input type="password" placeholder="New password (10+ chars)" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        <Button variant="outline" onClick={change} disabled={!cur || next.length < 10}>
          Change
        </Button>
      </div>
      {msg && <div className="mt-2 text-sm text-muted">{msg}</div>}
    </Section>
  );
}

export function SettingsView() {
  return (
    <div className="space-y-6">
      <ScheduleSection />
      <ScansSection />
      <CountriesSection />
      <FranchiseSection />
      <ReportsSection />
      <AccountSection />
    </div>
  );
}
