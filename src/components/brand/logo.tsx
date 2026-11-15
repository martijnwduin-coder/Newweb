import { cn } from "@/lib/utils";

/**
 * The Peloton chair: a café chair seen from the front, with an arched backrest —
 * a seat at the table, an invitation to sit together.
 */
export function ChairMark({ className, strokeWidth = 2.4 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <path d="M10 16.5V10a6 6 0 0 1 12 0v6.5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d="M13.5 9.5v6M18.5 9.5v6" stroke="currentColor" strokeWidth={strokeWidth * 0.6} strokeLinecap="round" opacity="0.6" />
      <path d="M7.5 17.5h17" stroke="currentColor" strokeWidth={strokeWidth * 1.25} strokeLinecap="round" />
      <path d="M10 18.5 9 27M22 18.5l1 8.5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

export function AppIcon({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-grid place-items-center rounded-[28%]", inverted ? "bg-paper text-ink" : "bg-ink text-paper", className)}>
      <ChairMark className="h-[62%] w-[62%]" />
    </span>
  );
}

export function Logo({ className, compact = false, tone = "dark" }: { className?: string; compact?: boolean; tone?: "dark" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)} aria-label="Peloton AI">
      <AppIcon className="h-8 w-8" inverted={tone === "light"} />
      {!compact && (
        <span className={cn("flex items-baseline gap-1 text-[15px] font-semibold tracking-[0.22em]", tone === "dark" ? "text-ink" : "text-paper")}>
          PELOTON
          <span className="text-[10px] font-semibold tracking-[0.12em] text-accent">AI</span>
        </span>
      )}
    </span>
  );
}
