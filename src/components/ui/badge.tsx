import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium [&_svg]:size-3", {
  variants: {
    variant: {
      default: "bg-forest-50 text-forest",
      sage: "bg-sage-100 text-forest",
      terracotta: "bg-terracotta-50 text-[#9a5638]",
      outline: "border border-cream-300 text-muted bg-white/60",
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
      className={cn("inline-flex items-center rounded-full border border-dashed border-terracotta/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-terracotta", className)}
    >
      Demo
    </span>
  );
}
