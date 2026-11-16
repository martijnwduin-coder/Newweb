"use client";
import { Check, Copy, Download, Link2, MessageCircle, Send, Share2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { friendIds, profileById } from "@/lib/selectors";
import { useStore } from "@/lib/store/store";
import type { Profile } from "@/lib/types";
import { isStaticSite } from "@/lib/config";
import { cn, siteOrigin } from "@/lib/utils";

export interface ShareTarget {
  kind: "place" | "collection" | "review";
  id: string;
  /** For in-app sends of a review, the place it refers to. */
  placeId?: string;
  title: string;
  subtitle?: string;
  image?: string | null;
  rating?: number | null;
  ratingLabel?: string;
  defaultMessage?: string;
}

export function shareUrl(t: Pick<ShareTarget, "kind" | "id" | "placeId">) {
  // A static site has no server-rendered /share pages: link straight to the page instead.
  if (isStaticSite) {
    const path = t.kind === "collection" ? `collections/${t.id}` : `place/${t.placeId ?? t.id}`;
    return `${siteOrigin()}/${path}/`;
  }
  return `${siteOrigin()}/share/${t.kind}/${encodeURIComponent(t.id)}`;
}

export function shareCardUrl(t: ShareTarget, format: "story" | "square" = "story") {
  const p = new URLSearchParams({ title: t.title, format });
  if (t.subtitle) p.set("subtitle", t.subtitle);
  if (t.image) p.set("image", t.image);
  if (t.rating != null) p.set("rating", t.rating.toFixed(1));
  if (t.ratingLabel) p.set("label", t.ratingLabel);
  return `/api/share-card?${p.toString()}`;
}

export function ShareDialog({ target, children }: { target: ShareTarget; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      {open && (
        <DialogContent title={`Share ${target.kind === "collection" ? "collection" : target.kind === "review" ? "review" : "place"}`} description={target.title}>
          <ShareBody target={target} onDone={() => setOpen(false)} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function ShareBody({ target, onDone }: { target: ShareTarget; onDone: () => void }) {
  const { db, meId, actions } = useStore();
  const friends = useMemo(() => friendIds(db, meId).map((id) => profileById(db, id)).filter(Boolean) as Profile[], [db, meId]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState(target.defaultMessage ?? defaultMessageFor(target));
  const [copied, setCopied] = useState(false);
  const url = shareUrl(target);
  const text = `${message}\n\n${target.title}${target.subtitle ? ` — ${target.subtitle}` : ""}\n${url}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: `${target.title} · Peloton AI`, text: message, url });
    } catch {
      /* user cancelled */
    }
  };

  const sendInApp = async () => {
    await actions.sendRecommendation({
      receiverIds: selected,
      placeId: target.kind === "collection" ? undefined : target.placeId ?? target.id,
      collectionId: target.kind === "collection" ? target.id : undefined,
      message,
    });
    onDone();
  };

  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className="space-y-6">
      {/* In-app */}
      <section>
        <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-muted">Send to friends on Peloton</h3>
        {friends.length === 0 ? (
          <p className="text-sm text-muted">Add friends to share places with them directly.</p>
        ) : (
          <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {friends.map((f) => {
              const on = selected.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelected((s) => (on ? s.filter((x) => x !== f.id) : [...s, f.id]))}
                  className="flex w-16 shrink-0 flex-col items-center gap-1.5"
                  aria-pressed={on}
                >
                  <span className="relative">
                    <Avatar user={f} size="lg" className={cn("transition", on && "ring-[3px] ring-ink ring-offset-2 ring-offset-paper")} />
                    {on && (
                      <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-paper ring-2 ring-paper">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </span>
                  <span className="w-full truncate text-center text-[12px] text-charcoal">{f.fullName.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
        )}
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="mt-3 min-h-20" maxLength={500} aria-label="Message" />
        <Button className="mt-3 w-full" disabled={!selected.length} onClick={sendInApp}>
          <Send /> Send{selected.length ? ` to ${selected.length}` : ""}
        </Button>
      </section>

      {/* Anywhere */}
      <section>
        <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-muted">Share anywhere</h3>
        <div className={cn("grid gap-2", isStaticSite ? "grid-cols-3" : "grid-cols-4")}>
          <ShareAction icon={copied ? Check : Link2} label={copied ? "Copied" : "Copy link"} onClick={copy} />
          <ShareAction
            icon={MessageCircle}
            label="WhatsApp"
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            className="text-[#1f9d55]"
          />
          <ShareAction icon={Share2} label="More" onClick={nativeShare} disabled={!canNativeShare} />
          {!isStaticSite && <ShareAction icon={Download} label="Story card" href={shareCardUrl(target, "story")} download={`peloton-${target.id}.png`} />}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-paper-300 bg-white px-3 py-2">
          <span className="flex-1 truncate text-[13px] text-muted">{url}</span>
          <button onClick={copy} className="rounded-lg p-1.5 text-muted hover:bg-paper-200" aria-label="Copy link">
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Card preview (needs the server-side image route) */}
      {!isStaticSite && (
      <section>
        <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-muted">Instagram-ready card</h3>
        <div className="flex justify-center rounded-2xl bg-paper-200 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shareCardUrl(target, "story")} alt="Share card preview" className="h-72 rounded-xl shadow-lift" />
        </div>
      </section>
      )}
    </div>
  );
}

function ShareAction({
  icon: Icon,
  label,
  onClick,
  href,
  download,
  disabled,
  className,
}: {
  icon: typeof Copy;
  label: string;
  onClick?: () => void;
  href?: string;
  download?: string;
  disabled?: boolean;
  className?: string;
}) {
  const inner = (
    <>
      <span className={cn("grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-soft transition group-hover:shadow-lift", className)}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-[12px] text-charcoal">{label}</span>
    </>
  );
  const cls = cn("group flex flex-col items-center gap-1.5", disabled && "pointer-events-none opacity-40");
  if (href)
    return (
      <a href={href} target={download ? undefined : "_blank"} rel="noreferrer" download={download} className={cls}>
        {inner}
      </a>
    );
  return (
    <button type="button" onClick={onClick} className={cls} disabled={disabled}>
      {inner}
    </button>
  );
}

function defaultMessageFor(t: ShareTarget) {
  if (t.kind === "collection") return `I made a list for you: ${t.title}.`;
  if (t.kind === "review") return `Read what I thought about ${t.title}.`;
  return `Found an amazing place${t.subtitle ? ` in ${t.subtitle.split("·").pop()?.trim()}` : ""}. You need to try this.`;
}
