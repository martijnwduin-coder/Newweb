import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badge = cva("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "bg-panel-2 text-muted border border-border",
      accent: "bg-accent-soft text-accent",
      good: "bg-good-soft text-good",
      warn: "bg-warn-soft text-warn",
      bad: "bg-bad-soft text-bad",
      solid: "bg-text text-bg",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...p} />;
}
