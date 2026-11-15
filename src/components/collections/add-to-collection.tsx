"use client";
import { Check, Lock, Plus, Users, Globe } from "lucide-react";
import { useState, type ReactNode } from "react";
import { PlaceImage } from "@/components/place/place-image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { collectionCover, collectionPlaceIds } from "@/lib/selectors";
import { useStore } from "@/lib/store/store";
import type { Visibility } from "@/lib/types";
import { cn } from "@/lib/utils";

export const VISIBILITY_META: Record<Visibility, { label: string; icon: typeof Globe; hint: string }> = {
  public: { label: "Public", icon: Globe, hint: "Anyone can see and follow" },
  friends: { label: "Friends", icon: Users, hint: "Only your friends" },
  private: { label: "Private", icon: Lock, hint: "Only you" },
};

export function AddToCollectionDialog({ placeId, children }: { placeId: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      {open && (
        <DialogContent title="Add to collection" description="Curate lists to keep and share.">
          <Body placeId={placeId} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function Body({ placeId }: { placeId: string }) {
  const { db, meId, actions } = useStore();
  const mine = db.collections.filter((c) => c.userId === meId).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  const [title, setTitle] = useState("");
  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim()) return;
          await actions.createCollection({ title: title.trim(), visibility: "friends", placeIds: [placeId] });
          setTitle("");
        }}
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New collection name" maxLength={120} />
        <Button type="submit" size="icon" className="h-11 w-11 shrink-0" disabled={!title.trim()} aria-label="Create collection">
          <Plus />
        </Button>
      </form>
      <ul className="space-y-1">
        {mine.map((c) => {
          const ids = collectionPlaceIds(db, c.id);
          const has = ids.includes(placeId);
          const V = VISIBILITY_META[c.visibility].icon;
          return (
            <li key={c.id}>
              <button onClick={() => actions.toggleInCollection(c.id, placeId)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-white">
                <PlaceImage src={collectionCover(db, c)} alt="" className="h-14 w-14 shrink-0 rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">{c.title}</span>
                  <span className="flex items-center gap-1 text-[12.5px] text-muted">
                    <V className="h-3 w-3" /> {VISIBILITY_META[c.visibility].label} · {ids.length} places
                  </span>
                </span>
                <span className={cn("grid h-7 w-7 place-items-center rounded-full border transition", has ? "border-forest bg-forest text-cream" : "border-cream-300 bg-white")}>
                  {has && <Check className="h-4 w-4" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
