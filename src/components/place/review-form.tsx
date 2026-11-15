"use client";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { StarInput } from "@/components/ui/stars";
import { myReview } from "@/lib/selectors";
import { useStore } from "@/lib/store/store";
import { REVIEW_TAGS, type Place, type ReviewInput, type ReviewTag } from "@/lib/types";

const SUB: { key: "food" | "drinks" | "atmosphere" | "service" | "value"; label: string }[] = [
  { key: "food", label: "Food" },
  { key: "drinks", label: "Drinks" },
  { key: "atmosphere", label: "Atmosphere" },
  { key: "service", label: "Service" },
  { key: "value", label: "Value for money" },
];

export function ReviewDialog({ place, children }: { place: Place; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { db, meId } = useStore();
  const existing = myReview(db, meId, place.id);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      {open && (
        <DialogContent title={existing ? "Edit your review" : `Rate ${place.name}`} description={existing ? "You can only have one review per place — changes replace it." : "Your honest take helps your friends choose."} className="sm:max-w-xl">
          <ReviewForm place={place} onDone={() => setOpen(false)} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function ReviewForm({ place, onDone }: { place: Place; onDone: () => void }) {
  const { db, meId, actions } = useStore();
  const existing = myReview(db, meId, place.id);
  const [overall, setOverall] = useState<number | null>(existing?.overall ?? null);
  const [sub, setSub] = useState<Record<string, number | null>>({
    food: existing?.food ?? null,
    drinks: existing?.drinks ?? null,
    atmosphere: existing?.atmosphere ?? null,
    service: existing?.service ?? null,
    value: existing?.value ?? null,
  });
  const [text, setText] = useState(existing?.text ?? "");
  const [photos, setPhotos] = useState<string[]>(existing?.photos ?? []);
  const [visitedOn, setVisitedOn] = useState(existing?.visitedOn ?? new Date().toISOString().slice(0, 10));
  const [price, setPrice] = useState<number | null>(existing?.priceLevel ?? place.priceLevel ?? null);
  const [items, setItems] = useState<string[]>(existing?.recommendedItems ?? []);
  const [itemDraft, setItemDraft] = useState("");
  const [tags, setTags] = useState<ReviewTag[]>(existing?.tags ?? []);
  const [uploading, setUploading] = useState(false);
  const [showDetail, setShowDetail] = useState(Boolean(existing && SUB.some((s) => existing[s.key] != null)));
  const fileRef = useRef<HTMLInputElement>(null);

  const addItem = () => {
    const v = itemDraft.trim();
    if (v && !items.includes(v) && items.length < 8) setItems([...items, v]);
    setItemDraft("");
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(
        [...files].slice(0, 6 - photos.length).map((f) => {
          if (!f.type.startsWith("image/")) throw new Error("Only images can be uploaded");
          if (f.size > 10_000_000) throw new Error("Images must be under 10 MB");
          return actions.uploadPhoto(f);
        }),
      );
      setPhotos((p) => [...p, ...urls]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!overall) return toast.error("Choose an overall rating first");
    const input: ReviewInput = {
      overall,
      food: sub.food,
      drinks: sub.drinks,
      atmosphere: sub.atmosphere,
      service: sub.service,
      value: sub.value,
      text: text.trim(),
      photos,
      visitedOn: visitedOn || null,
      priceLevel: price,
      recommendedItems: items,
      tags,
    };
    onDone();
    await actions.saveReview(place.id, input);
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div>
        <Label>Overall</Label>
        <StarInput value={overall} onChange={setOverall} label="Overall rating" size={36} />
        <p className="mt-1 text-[12px] text-muted">Tap the left half of a star for half ratings.</p>
      </div>

      <div className="rounded-2xl bg-white p-4">
        <button type="button" onClick={() => setShowDetail((v) => !v)} className="flex w-full items-center justify-between text-[14px] font-medium">
          Rate the details <span className="text-[12px] text-muted">{showDetail ? "Hide" : "Optional"}</span>
        </button>
        {showDetail && (
          <div className="mt-4 space-y-3">
            {SUB.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3">
                <span className="text-[13.5px] text-charcoal">{s.label}</span>
                <StarInput value={sub[s.key]} onChange={(v) => setSub((x) => ({ ...x, [s.key]: v }))} label={s.label} size={22} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="review-text">Your review</Label>
        <Textarea id="review-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="What made it worth the trip?" maxLength={4000} className="min-h-28" />
      </div>

      <div>
        <Label>What should people order?</Label>
        <div className="flex flex-wrap gap-2">
          {items.map((i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-forest-50 py-1 pl-3 pr-1.5 text-[13px] text-forest">
              {i}
              <button type="button" onClick={() => setItems(items.filter((x) => x !== i))} className="rounded-full p-0.5 hover:bg-sage-100" aria-label={`Remove ${i}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <Input
          value={itemDraft}
          onChange={(e) => setItemDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addItem();
            }
          }}
          onBlur={addItem}
          placeholder="e.g. Cacio e pepe — press Enter to add"
          className="mt-2"
        />
      </div>

      <div>
        <Label>Tags</Label>
        <div className="flex flex-wrap gap-2">
          {REVIEW_TAGS.map((t) => (
            <Chip key={t} active={tags.includes(t)} onClick={() => setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]))} className="h-8 capitalize">
              {t}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="visited">Date visited</Label>
          <Input id="visited" type="date" value={visitedOn ?? ""} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setVisitedOn(e.target.value)} />
        </div>
        <div>
          <Label>Price</Label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((p) => (
              <Chip key={p} active={price === p} onClick={() => setPrice(price === p ? null : p)} className="h-11 flex-1 justify-center px-0">
                {"€".repeat(p)}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div>
        <Label>Photos</Label>
        <div className="flex flex-wrap gap-2">
          {photos.map((src) => (
            <span key={src} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-20 w-20 rounded-xl object-cover" />
              <button type="button" onClick={() => setPhotos(photos.filter((p) => p !== src))} className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-charcoal text-white" aria-label="Remove photo">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {photos.length < 6 && (
            <button type="button" onClick={() => fileRef.current?.click()} className="grid h-20 w-20 place-items-center rounded-xl border border-dashed border-cream-300 bg-white text-muted hover:border-sage" aria-label="Add photos">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        </div>
      </div>

      <div className="flex gap-2 border-t border-cream-300/70 pt-5">
        {existing && (
          <Button
            type="button"
            variant="ghost"
            className="text-[#a14b2c]"
            onClick={() => {
              if (confirm("Delete your review?")) {
                onDone();
                actions.deleteReview(existing.id);
              }
            }}
          >
            <Trash2 /> Delete
          </Button>
        )}
        <Button type="submit" className="ml-auto min-w-36" disabled={!overall || uploading}>
          {existing ? "Save changes" : "Publish review"}
        </Button>
      </div>
    </form>
  );
}
