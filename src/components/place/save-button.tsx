"use client";
import { Bookmark } from "lucide-react";
import { isSaved } from "@/lib/selectors";
import { useStore } from "@/lib/store/store";
import { cn } from "@/lib/utils";

export function SaveButton({ placeId, variant = "glass", className }: { placeId: string; variant?: "glass" | "plain" | "full"; className?: string }) {
  const { db, meId, actions } = useStore();
  const saved = isSaved(db, meId, placeId);
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    actions.toggleSave(placeId);
  };
  if (variant === "full")
    return (
      <button onClick={onClick} className={cn("inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition active:scale-95", saved ? "bg-forest text-cream" : "border border-cream-300 bg-white text-charcoal hover:border-sage", className)}>
        <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
        {saved ? "Saved" : "Save"}
      </button>
    );
  return (
    <button
      onClick={onClick}
      aria-label={saved ? "Remove from saved" : "Save place"}
      aria-pressed={saved}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full transition active:scale-90",
        variant === "glass" ? "bg-white/90 text-charcoal shadow-soft backdrop-blur hover:bg-white" : "text-charcoal hover:bg-cream-200",
        saved && "text-forest",
        className,
      )}
    >
      <Bookmark className={cn("h-4 w-4 transition", saved && "fill-forest")} />
    </button>
  );
}
