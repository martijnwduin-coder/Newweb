"use client";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  subtitle,
  href,
  action,
  className,
  index,
  dark = false,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  action?: ReactNode;
  className?: string;
  index?: string;
  dark?: boolean;
}) {
  return (
    <div className={cn("mb-6 flex items-end justify-between gap-6", className)}>
      <div className="min-w-0">
        {index && <p className={cn("eyebrow mb-1.5", dark ? "text-white/50" : "text-muted")}>{index}</p>}
        <h2 className={cn("display text-[24px] sm:text-[28px]", dark ? "text-white" : "text-ink")}>{title}</h2>
        {subtitle && <p className={cn("mt-1 max-w-xl text-[15px]", dark ? "text-white/60" : "text-muted")}>{subtitle}</p>}
      </div>
      {action}
      {href && (
        <Link href={href} className="group inline-flex shrink-0 items-center gap-1 text-[14px] font-medium text-ink hover:underline">
          See all <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

export function Rail({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <div className="group/rail relative">
      <div ref={ref} className={cn("no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 sm:-mx-8 sm:scroll-px-8 sm:px-8", className)}>
        {children}
      </div>
      {[-1, 1].map((d) => (
        <button
          key={d}
          onClick={() => scroll(d as 1 | -1)}
          aria-label={d < 0 ? "Scroll left" : "Scroll right"}
          className={cn(
            "absolute top-[38%] hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white text-charcoal opacity-0 shadow-lift transition group-hover/rail:opacity-100 lg:grid",
            d < 0 ? "-left-3" : "-right-3",
          )}
        >
          {d < 0 ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: React.ComponentType<{ className?: string }>; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-paper-300 bg-white/40 px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-50 text-ink">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-[15px] font-semibold text-charcoal">{title}</p>
      {body && <p className="mt-1 max-w-sm text-[14px] text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
