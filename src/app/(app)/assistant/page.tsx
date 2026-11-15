"use client";
import { ArrowUp, Info, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PlaceImage } from "@/components/place/place-image";
import { PelotonRating } from "@/components/place/rating";
import { SaveButton } from "@/components/place/save-button";
import { AppIcon } from "@/components/brand/logo";
import { profileSummary, recommend, templateAnswer, type Candidate } from "@/lib/ai/engine";
import { tasteProfile } from "@/lib/selectors";
import { useStore } from "@/lib/store/store";
import { CATEGORY_META, cn, priceLabel } from "@/lib/utils";

const SUGGESTIONS = [
  "Find me a great Italian restaurant in Amsterdam recommended by my friends.",
  "Where should I get coffee near me?",
  "Find somewhere similar to the restaurants I rated highly.",
  "What are the best places my friends have saved in Copenhagen?",
  "Give me five great date-night restaurants.",
  "A hidden-gem bakery in Paris",
];

interface Turn {
  id: string;
  query: string;
  status: "thinking" | "done";
  intro: string;
  picks: { c: Candidate; why?: string }[];
  source: "engine" | "llm";
  note?: string;
}

export default function AssistantPage() {
  const { db, meId, me } = useStore();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const taste = tasteProfile(db, meId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const getLocation = () =>
    new Promise<{ lat: number; lng: number } | null>((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { timeout: 6000 },
      );
    });

  const ask = async (query: string) => {
    if (!query.trim() || busy) return;
    setBusy(true);
    setInput("");
    const id = crypto.randomUUID();
    setTurns((t) => [...t, { id, query, status: "thinking", intro: "", picks: [], source: "engine" }]);

    const wantsLocation = /near me|nearby|close by|around me|walking distance/i.test(query);
    const location = wantsLocation ? await getLocation() : null;
    const { intent, candidates, relaxed } = recommend(db, meId, query, { location });
    const top = candidates.slice(0, intent.count);
    let turn: Turn = {
      id,
      query,
      status: "done",
      intro: templateAnswer(intent, top),
      picks: top.map((c) => ({ c })),
      source: "engine",
      note: relaxed ?? (wantsLocation && !location ? "Location wasn't available, so I searched your whole network instead." : undefined),
    };

    try {
      const shortlist = candidates.slice(0, Math.max(intent.count * 2, 8));
      const res = await fetch("/api/ai/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          count: intent.count,
          profile: profileSummary(db, meId),
          candidates: shortlist.map((c) => ({
            id: c.place.id,
            name: c.place.name,
            category: c.place.category,
            cuisine: c.place.cuisine,
            city: c.place.city,
            neighborhood: c.place.neighborhood,
            priceLevel: c.place.priceLevel,
            pelotonRating: c.pelotonRating,
            pelotonReviewCount: c.pelotonReviewCount,
            friendRecommenders: c.friendRecommenders,
            facts: c.facts.slice(0, 8),
          })),
        }),
      });
      const json = await res.json();
      if (json.mode === "llm" && Array.isArray(json.picks)) {
        const byId = new Map(shortlist.map((c) => [c.place.id, c]));
        const picks = (json.picks as { id: string; why: string }[]).map((p) => ({ c: byId.get(p.id)!, why: p.why })).filter((p) => p.c);
        turn = { ...turn, intro: json.intro, picks, source: "llm" };
      } else if (json.error) {
        turn = { ...turn, note: [relaxed, json.error].filter(Boolean).join(" ") };
      }
    } catch {
      // Network issue — keep the grounded engine answer.
    }
    setTurns((t) => t.map((x) => (x.id === id ? turn : x)));
    setBusy(false);
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-3xl flex-col px-4 pb-40 pt-6 sm:px-8 lg:min-h-dvh lg:pt-12">
      {turns.length === 0 ? (
        <div className="animate-fade-up">
          <AppIcon className="h-14 w-14 shadow-lift" />
          <h1 className="display mt-6 text-[38px] text-forest sm:text-[48px]">
            Ask Peloton<span className="text-terracotta">.</span>
          </h1>
          <p className="mt-3 max-w-lg text-[16px] text-muted">
            Describe the evening you want. I&apos;ll search places your friends rated, saved and recommended — then your wider community.
          </p>
          <div className="mt-6 flex items-start gap-3 rounded-2xl bg-white/70 p-4 text-[13px] text-charcoal/80">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
            <p>
              Answers only use real data in Peloton: reviews, ratings and saves from people{me ? ` ${me.fullName.split(" ")[0]} trusts` : ""}. Nothing is made up. Your taste profile:{" "}
              <b className="font-semibold">{taste.title}</b>
              {taste.traits.length ? ` · ${taste.traits.slice(0, 2).join(", ")}` : ""}.
            </p>
          </div>
          <div className="mt-8 grid gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)} className="rounded-2xl border border-cream-300 bg-white p-4 text-left text-[14px] leading-snug text-charcoal shadow-soft transition hover:border-sage hover:shadow-lift">
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {turns.map((t) => (
            <div key={t.id} className="animate-fade-up space-y-4">
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-3xl rounded-br-lg bg-forest px-4 py-3 text-[15px] text-cream">{t.query}</p>
              </div>
              {t.status === "thinking" ? (
                <p className="flex items-center gap-2 text-[14px] text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking what your friends think…
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <AppIcon className="h-8 w-8 shrink-0" />
                    <div>
                      <p className="text-[15.5px] leading-relaxed text-charcoal">{t.intro}</p>
                      {t.note && (
                        <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted">
                          <Info className="h-3.5 w-3.5" /> {t.note}
                        </p>
                      )}
                    </div>
                  </div>
                  <ol className="space-y-3 sm:pl-11">
                    {t.picks.map(({ c, why }, i) => (
                      <PickCard key={c.place.id} c={c} why={why} rank={i + 1} />
                    ))}
                  </ol>
                  <p className="flex items-center gap-1.5 text-[11.5px] text-muted sm:pl-11">
                    <Sparkles className="h-3 w-3" />
                    {t.source === "llm" ? "Ranked from verified Peloton data, written by Claude." : "Ranked by Peloton's recommendation engine from verified reviews and saves."}
                  </p>
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="fixed inset-x-0 bottom-16 z-30 bg-gradient-to-t from-cream via-cream to-transparent px-4 pb-4 pt-8 lg:bottom-0 lg:left-[248px]"
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-full border border-cream-300 bg-white p-1.5 pl-5 shadow-lift focus-within:ring-4 focus-within:ring-sage/25">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="A cosy natural wine bar in Copenhagen…" className="h-11 flex-1 bg-transparent text-[15px] focus:outline-none" aria-label="Ask Peloton" />
          <button type="submit" disabled={!input.trim() || busy} className="grid h-11 w-11 place-items-center rounded-full bg-forest text-cream transition disabled:opacity-40" aria-label="Send">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}

function PickCard({ c, why, rank }: { c: Candidate; why?: string; rank: number }) {
  const [open, setOpen] = useState(false);
  const p = c.place;
  return (
    <li className="overflow-hidden rounded-3xl bg-white shadow-soft">
      <div className="flex gap-3 p-3">
        <Link href={`/place/${p.id}`} className="relative shrink-0">
          <PlaceImage src={p.imageUrl} alt={p.name} category={p.category} className="h-24 w-24 rounded-2xl" />
          <span className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white text-[12px] font-semibold shadow-soft">{rank}</span>
        </Link>
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/place/${p.id}`} className="truncate text-[16px] font-semibold tracking-tight hover:underline">
              {p.name}
            </Link>
            <SaveButton placeId={p.id} variant="plain" className="-mr-1 -mt-1 shrink-0" />
          </div>
          <p className="truncate text-[13px] text-muted">
            {p.cuisine ?? CATEGORY_META[p.category].label}
            {priceLabel(p.priceLevel) ? ` · ${priceLabel(p.priceLevel)}` : ""} · {p.neighborhood ?? p.city}
          </p>
          <PelotonRating rating={c.pelotonRating} count={c.pelotonReviewCount} size="sm" className="mt-1" />
          <p className="mt-1.5 text-[13.5px] leading-snug text-charcoal/85">{why ?? c.facts[0]}</p>
        </div>
      </div>
      <button onClick={() => setOpen((v) => !v)} className={cn("flex w-full items-center gap-1.5 border-t border-cream-200 px-4 py-2 text-left text-[12px] font-medium text-forest", open && "bg-cream/50")}>
        <ShieldCheck className="h-3.5 w-3.5" /> {open ? "Hide" : "Why this?"} · {c.facts.length} verified {c.facts.length === 1 ? "signal" : "signals"}
      </button>
      {open && (
        <ul className="space-y-1 bg-cream/50 px-4 pb-3 text-[12.5px] text-charcoal/80">
          {c.facts.map((f) => (
            <li key={f}>· {f}</li>
          ))}
        </ul>
      )}
    </li>
  );
}
