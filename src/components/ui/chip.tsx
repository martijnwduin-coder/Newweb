import * as React from "react";
import { cn } from "@/lib/utils";

export function Chip({ active, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-all [&_svg]:size-3.5",
        active ? "border-ink bg-ink text-paper shadow-soft" : "border-paper-300 bg-white/80 text-charcoal hover:border-stone",
        className,
      )}
      {...props}
    />
  );
}
