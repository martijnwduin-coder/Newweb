"use client";
import { ArrowUpRight, Bell, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ChairMark, Logo } from "@/components/brand/logo";
import { ArrowButton } from "@/components/ui/arrow-button";
import { Avatar } from "@/components/ui/avatar";
import { resetDemoData } from "@/lib/backend/demo";
import { useStore } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { isActive, NAV } from "./nav";

export function useUnreadCount() {
  const { db, meId } = useStore();
  return db.notifications.filter((n) => n.userId === meId && !n.isRead).length;
}

/** Dark top navigation (desktop + mobile). */
function TopNav() {
  const pathname = usePathname();
  const { me, mode } = useStore();
  const unread = useUnreadCount();
  const hideOnMobile = pathname.startsWith("/map") || pathname.startsWith("/place/");
  return (
    <header className={cn("section-dark sticky top-0 z-40 border-b border-white/10", hideOnMobile && "max-lg:hidden")}>
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-4 sm:px-8 lg:h-[72px]">
        <Link href="/" className="shrink-0">
          <Logo tone="light" />
        </Link>
        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {NAV.map(({ href, label }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative rounded-full px-4 py-2 text-[14px] transition-colors duration-300",
                  active ? "bg-white/10 text-paper" : "text-paper/60 hover:text-paper",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {mode === "demo" && (
            <span className="hidden rounded-full border border-dashed border-accent/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent sm:inline" title="Fictional sample data">
              Demo
            </span>
          )}
          <Link href="/assistant" className="grid h-10 w-10 place-items-center rounded-full text-paper hover:bg-white/10 lg:hidden" aria-label="Ask Peloton AI">
            <Sparkles className="h-5 w-5" />
          </Link>
          <Link href="/notifications" className="relative grid h-10 w-10 place-items-center rounded-full text-paper hover:bg-white/10" aria-label="Notifications">
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-ink">{unread}</span>}
          </Link>
          {me && (
            <Link href="/profile" className="hidden lg:block" aria-label="Your profile">
              <Avatar user={me} size="sm" className="ring-1 ring-white/20" />
            </Link>
          )}
          <ArrowButton href="/assistant" className="ml-2 hidden h-11 pl-5 lg:inline-flex">
            Ask Peloton
          </ArrowButton>
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const pathname = usePathname();
  const { me } = useStore();
  return (
    <nav className="section-dark pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/10 lg:hidden">
      <div className="mx-auto flex h-16 max-w-md items-stretch justify-around">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} className={cn("flex flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-medium transition", active ? "text-accent" : "text-paper/55")}>
              {href === "/profile" && me ? (
                <Avatar user={me} size="xs" className={cn(active && "ring-2 ring-accent ring-offset-1 ring-offset-ink")} />
              ) : (
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.7} />
              )}
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Big editorial footer with a giant call to action. */
function Footer() {
  const { mode } = useStore();
  return (
    <footer className="section-dark mt-24 rounded-t-[2.5rem] px-4 pb-28 pt-16 sm:px-8 lg:pb-12 lg:pt-24">
      <div className="mx-auto max-w-[1440px]">
        <p className="eyebrow text-paper/50">Good places. Better connections.</p>
        <Link href="/map" className="group mt-6 flex items-end justify-between gap-6 border-b border-white/15 pb-10">
          <span className="display text-[56px] sm:text-[96px] lg:text-[140px]">
            Where to <span className="text-accent">next?</span>
          </span>
          <span className="mb-4 grid h-16 w-16 shrink-0 place-items-center rounded-full bg-accent text-ink transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-45 sm:h-24 sm:w-24">
            <ArrowUpRight className="h-7 w-7 sm:h-10 sm:w-10" />
          </span>
        </Link>
        <div className="mt-10 grid gap-10 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-paper text-ink">
              <ChairMark className="h-6 w-6" />
            </span>
            <p className="max-w-[16rem] text-[14px] leading-relaxed text-paper/60">Discover places through people, not algorithms.</p>
          </div>
          <ul className="space-y-2 text-[15px]">
            {NAV.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="text-paper/70 transition hover:text-accent">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          {mode === "demo" ? (
            <div className="text-[13px] leading-relaxed text-paper/60">
              <p className="font-semibold text-accent">Demo mode</p>
              <p className="mt-1">All people, places and reviews are fictional sample data stored in your browser.</p>
              <button
                onClick={() => {
                  resetDemoData();
                  location.reload();
                }}
                className="mt-3 inline-flex items-center gap-1.5 text-paper underline-offset-4 hover:underline"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset demo
              </button>
            </div>
          ) : (
            <p className="text-[13px] text-paper/60">© {new Date().getFullYear()} Peloton AI</p>
          )}
        </div>
      </div>
    </footer>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { ready, loadError, actions } = useStore();
  const pathname = usePathname();
  const immersive = pathname.startsWith("/map") || pathname.startsWith("/assistant");
  return (
    <div className="min-h-dvh">
      <TopNav />
      <main className={cn(!immersive && "pb-6")}>
        {loadError ? (
          <div className="mx-auto max-w-md px-6 py-24 text-center">
            <p className="text-lg font-semibold">We couldn&apos;t load your Peloton.</p>
            <p className="mt-2 text-sm text-muted">{loadError}</p>
            <button onClick={() => actions.reload()} className="mt-6 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper">
              Try again
            </button>
          </div>
        ) : ready ? (
          children
        ) : (
          <ShellSkeleton />
        )}
      </main>
      {!immersive && ready && <Footer />}
      <BottomNav />
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-8">
      <div className="skeleton h-24 w-3/4 rounded-2xl" />
      <div className="mt-10 flex gap-4 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton aspect-[4/5] w-[300px] shrink-0 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
