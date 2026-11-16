"use client";
import { ArrowRight, Bell, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { resetDemoData } from "@/lib/backend/demo";
import { useStore } from "@/lib/store/store";
import { cn } from "@/lib/utils";
import { isActive, NAV } from "./nav";

export function useUnreadCount() {
  const { db, meId } = useStore();
  return db.notifications.filter((n) => n.userId === meId && !n.isRead).length;
}

/** Light top navigation (desktop + mobile). */
function TopNav() {
  const pathname = usePathname();
  const { me, mode } = useStore();
  const unread = useUnreadCount();
  const hideOnMobile = pathname.startsWith("/map") || pathname.startsWith("/place/");
  return (
    <header className={cn("sticky top-0 z-40 border-b border-black/[0.06] bg-paper/90 backdrop-blur-md", hideOnMobile && "max-lg:hidden")}>
      <div className="mx-auto grid h-14 max-w-[1100px] grid-cols-[1fr_auto_1fr] items-center gap-6 px-4 sm:px-8">
        <Link href="/" className="justify-self-start">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map(({ href, label }) => {
            const active = isActive(pathname, href);
            return (
              <Link key={href} href={href} className={cn("rounded-lg px-3.5 py-1.5 text-[15px] transition-colors", active ? "text-ink" : "text-[#4d4d4d] hover:text-ink")}>
                <span className={cn(active && "underline decoration-1 underline-offset-[6px]")}>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="col-start-3 flex items-center justify-self-end gap-1.5">
          {mode === "demo" && (
            <span className="hidden rounded-md bg-accent-50 px-2 py-0.5 text-[11px] font-medium text-accent sm:inline" title="Fictional sample data">
              Demo
            </span>
          )}
          <Link href="/assistant" className="grid h-9 w-9 place-items-center rounded-lg text-ink hover:bg-paper-200 lg:hidden" aria-label="Ask Peloton AI">
            <Sparkles className="h-[18px] w-[18px]" />
          </Link>
          <Link href="/notifications" className="relative grid h-9 w-9 place-items-center rounded-lg text-ink hover:bg-paper-200" aria-label="Notifications">
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">{unread}</span>}
          </Link>
          {me && (
            <Link href="/profile" className="hidden lg:block" aria-label="Your profile">
              <Avatar user={me} size="sm" />
            </Link>
          )}
          <Link href="/assistant" className="ml-1.5 hidden h-8 items-center rounded-lg bg-ink px-3 text-[14px] font-medium text-white hover:bg-black lg:inline-flex">
            Ask Peloton
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Thin announcement strip under the nav on the home page. */
function Announcement() {
  return (
    <Link href="/assistant" className="group flex h-11 items-center justify-center gap-1.5 bg-paper-200 text-[14.5px] font-medium text-ink">
      Introducing Ask Peloton — recommendations from people you trust
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function BottomNav() {
  const pathname = usePathname();
  const { me } = useStore();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.06] bg-paper/95 backdrop-blur-md lg:hidden">
      <div className="mx-auto flex h-16 max-w-md items-stretch justify-around">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} className={cn("flex flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-medium transition", active ? "text-ink" : "text-ink/45")}>
              {href === "/profile" && me ? (
                <Avatar user={me} size="xs" className={cn(active && "ring-2 ring-ink ring-offset-1 ring-offset-paper")} />
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

/** Dark footer: serif line + link columns. */
function Footer() {
  const { mode } = useStore();
  return (
    <footer className="mt-28 bg-ink px-4 pb-28 pt-16 text-white sm:px-8 lg:pb-14">
      <div className="mx-auto max-w-[1100px]">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <Logo tone="light" />
            <p className="display mt-8 text-[32px] sm:text-[36px]">
              Good places,
              <br />
              better connections.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div>
              <h3 className="text-[14px] font-medium">Discover</h3>
              <ul className="mt-4 space-y-2.5 text-[14px] text-white/60">
                {NAV.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} className="hover:text-white">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[14px] font-medium">Ask Peloton</h3>
              <ul className="mt-4 space-y-2.5 text-[14px] text-white/60">
                {["Coffee near me", "Date night", "Hidden gems", "Brunch with friends"].map((q) => (
                  <li key={q}>
                    <Link href={`/assistant?q=${encodeURIComponent(q)}`} className="hover:text-white">
                      {q}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[14px] font-medium">{mode === "demo" ? "Demo mode" : "Account"}</h3>
              {mode === "demo" ? (
                <div className="mt-4 text-[14px] leading-relaxed text-white/60">
                  <p>All people, places and reviews are fictional sample data stored in your browser.</p>
                  <button
                    onClick={() => {
                      resetDemoData();
                      location.reload();
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 text-white hover:underline"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset demo
                  </button>
                </div>
              ) : (
                <ul className="mt-4 space-y-2.5 text-[14px] text-white/60">
                  <li>
                    <Link href="/settings" className="hover:text-white">
                      Settings & privacy
                    </Link>
                  </li>
                  <li>
                    <Link href="/notifications" className="hover:text-white">
                      Notifications
                    </Link>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
        <p className="mt-16 border-t border-white/10 pt-6 text-[13px] text-white/40">© {new Date().getFullYear()} Peloton AI</p>
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
      {pathname === "/" && <Announcement />}
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
    <div className="mx-auto max-w-[1100px] px-4 py-16 sm:px-8">
      <div className="skeleton mx-auto h-12 w-96 max-w-full rounded-xl" />
      <div className="mt-10 flex gap-4 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton aspect-[4/5] w-[300px] shrink-0 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
