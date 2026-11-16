import { Star } from "lucide-react";
import { cn, formatRating } from "@/lib/utils";

/** Peloton community rating. Always labelled so it is never confused with Google's. */
export function PelotonRating({ rating, count, className, size = "md" }: { rating: number | null; count: number; className?: string; size?: "sm" | "md" }) {
  if (!count)
    return <span className={cn("text-[12px] text-muted", className)}>No Peloton reviews yet</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 font-semibold text-charcoal", size === "sm" ? "text-[12px]" : "text-[13px]", className)} title="Peloton community rating">
      <Star className={cn("fill-star text-star", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
      {formatRating(rating)}
      <span className="font-normal text-muted">({count})</span>
    </span>
  );
}

/** External Google Places rating — visually distinct and explicitly attributed. */
export function GoogleRating({ rating, count, className }: { rating?: number | null; count?: number | null; className?: string }) {
  if (rating == null) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-paper-300 bg-white px-2 py-0.5 text-[11px] text-muted", className)} title="Rating from Google Places, not from Peloton members">
      <span className="font-semibold text-[#4285F4]">G</span>
      <span className="font-medium text-charcoal">{rating.toFixed(1)}</span>
      {count ? <span>· {count.toLocaleString()} on Google</span> : <span>on Google</span>}
    </span>
  );
}
