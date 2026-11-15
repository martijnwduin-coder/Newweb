import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium [&_svg]:size-3", {
  variants: {
    variant: {
      default: "bg-ink-50 text-ink",
      sage: "bg-stone-100 text-ink",
      terracotta: "bg-accent-50 text-[#B4380C]",
      outline: "border border-paper-300 text-muted bg-white/60",
      glass: "bg-white/85 text-charcoal backdrop-blur",
      dark: "bg-charcoal/75 text-white backdrop-blur",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      title="Sample data for demo mode — not real reviews or ratings"
      className={cn("inline-flex items-center rounded-full border border-dashed border-accent/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent", className)}
    >
      Demo
    </span>
  );
}
