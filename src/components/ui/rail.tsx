"use client";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
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
    <div className={cn("mb-8 flex items-end justify-between gap-6", className)}>
      <div className="min-w-0">
        {index && <p className={cn("eyebrow mb-3", dark ? "text-accent" : "text-accent")}>{index}</p>}
        <h2 className={cn("display text-[32px] sm:text-[44px] lg:text-[52px]", dark ? "text-paper" : "text-ink")}>{title}</h2>
        {subtitle && <p className={cn("mt-2 max-w-xl text-[15px]", dark ? "text-paper/60" : "text-muted")}>{subtitle}</p>}
      </div>
      {action}
      {href && (
        <Link
          href={href}
          className={cn(
            "group hidden shrink-0 items-center gap-2 rounded-full border py-2 pl-4 pr-2 text-[13.5px] font-medium transition-colors duration-300 sm:inline-flex",
            dark ? "border-white/20 text-paper hover:border-white/50" : "border-ink/15 text-ink hover:border-ink/40",
          )}
        >
          See all
          <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-ink transition-transform duration-500 group-hover:rotate-45">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
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
