"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useStore } from "@/lib/store/store";
import type { Collection, Visibility } from "@/lib/types";
import { cn } from "@/lib/utils";
import { VISIBILITY_META } from "./add-to-collection";

export function CollectionEditor({ collection, children, onCreated }: { collection?: Collection; children: ReactNode; onCreated?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      {open && (
        <DialogContent title={collection ? "Edit collection" : "New collection"} description="Give it a title worth sharing.">
          <Form
            collection={collection}
            onDone={(id) => {
              setOpen(false);
              if (id) onCreated?.(id);
            }}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}

function Form({ collection, onDone }: { collection?: Collection; onDone: (id?: string) => void }) {
  const { actions } = useStore();
  const [title, setTitle] = useState(collection?.title ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [visibility, setVisibility] = useState<Visibility>(collection?.visibility ?? "public");
  const [cover, setCover] = useState(collection?.coverImage ?? "");
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        if (collection) {
          await actions.updateCollection({ ...collection, title: title.trim(), description, visibility, coverImage: cover || null });
          onDone();
        } else {
          const id = await actions.createCollection({ title: title.trim(), description, visibility, coverImage: cover || null });
          onDone(id);
        }
      }}
    >
      <div>
        <Label htmlFor="c-title">Title</Label>
        <Input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Hidden gems in Paris" maxLength={120} autoFocus />
      </div>
      <div>
        <Label htmlFor="c-desc">Description</Label>
        <Textarea id="c-desc" value={description ?? ""} onChange={(e) => setDescription(e.target.value)} placeholder="What ties these places together?" maxLength={1000} />
      </div>
      <div>
        <Label htmlFor="c-cover">Cover image URL (optional)</Label>
        <Input id="c-cover" value={cover} onChange={(e) => setCover(e.target.value)} placeholder="Defaults to the first place's photo" type="url" />
      </div>
      <div>
        <Label>Visibility</Label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(VISIBILITY_META) as Visibility[]).map((v) => {
            const M = VISIBILITY_META[v];
            return (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                aria-pressed={visibility === v}
                className={cn("flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition", visibility === v ? "border-forest bg-forest-50" : "border-cream-300 bg-white hover:border-sage")}
              >
                <M.icon className="h-4 w-4" />
                <span className="text-[13.5px] font-medium">{M.label}</span>
                <span className="text-[11.5px] leading-tight text-muted">{M.hint}</span>
              </button>
            );
          })}
        </div>
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={!title.trim()}>
        {collection ? "Save" : "Create collection"}
      </Button>
    </form>
  );
}
