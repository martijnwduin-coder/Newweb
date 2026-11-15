import { Coffee, Croissant, UtensilsCrossed, Wine } from "lucide-react";
import type { Category } from "@/lib/types";
import { CATEGORY_META, cn } from "@/lib/utils";

const ICON: Record<Category, typeof Coffee> = { restaurant: UtensilsCrossed, coffee: Coffee, cafe: Coffee, bakery: Croissant, bar: Wine };

export interface PinState {
  category: Category;
  active?: boolean;
  friend?: boolean;
  saved?: boolean;
  rating?: number | null;
  external?: boolean;
}

/** Custom map marker. Category sets colour + icon; friend picks get a terracotta halo. */
export function MarkerPin({ category, active, friend, saved, rating, external }: PinState) {
  const Icon = ICON[category];
  const color = CATEGORY_META[category].color;
  return (
    <div className={cn("relative flex flex-col items-center transition-transform duration-200", active ? "z-20 scale-[1.18]" : "hover:scale-110")}>
      <div
        className={cn(
          "flex h-9 items-center gap-1 rounded-full pl-1 pr-2 text-[12px] font-semibold shadow-lift ring-2",
          external ? "bg-white text-charcoal ring-white" : "text-white ring-white",
          friend && "ring-accent",
          active && "ring-[3px]",
        )}
        style={external ? undefined : { background: color }}
      >
        <span className={cn("grid h-7 w-7 place-items-center rounded-full", external ? "bg-paper-200" : "bg-white/15")}>
          <Icon className="h-3.5 w-3.5" style={external ? { color } : undefined} />
        </span>
        {rating != null ? rating.toFixed(1) : external ? "G" : "New"}
      </div>
      <span className={cn("-mt-[3px] h-2.5 w-2.5 rotate-45 shadow", external ? "bg-white" : "")} style={external ? undefined : { background: color }} />
      {saved && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-ink" title="Saved" />}
      {friend && <span className="absolute -left-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-accent" title="Friend pick" />}
    </div>
  );
}
