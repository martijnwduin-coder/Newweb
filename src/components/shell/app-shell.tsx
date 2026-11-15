"use client";
import { Bell, RotateCcw, Sparkles } from "lucide-react";
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

function Sidebar() {
  const pathname = usePathname();
  const { me, mode } = useStore();
  const unread = useUnreadCount();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-cream-300/70 bg-cream/90 px-4 py-6 backdrop-blur lg:flex">
      <Link href="/" className="px-2">
        <Logo />
      </Link>
      <nav className="mt-10 flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex h-11 items-center gap-3 rounded-xl px-3 text-[14.5px] font-medium transition",
                active ? "bg-white text-forest shadow-soft" : "text-charcoal/75 hover:bg-white/60 hover:text-charcoal",
              )}
            >
              <Icon className={cn("h-[18px] w-[18px]", active && "text-forest")} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
        <Link
          href="/notifications"
          className={cn(
            "flex h-11 items-center gap-3 rounded-xl px-3 text-[14.5px] font-medium transition",
            pathname.startsWith("/notifications") ? "bg-white text-forest shadow-soft" : "text-charcoal/75 hover:bg-white/60",
          )}
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
          Notifications
          {unread > 0 && <span className="ml-auto rounded-full bg-terracotta px-1.5 text-[11px] font-semibold text-white">{unread}</span>}
        </Link>
      </nav>

      <Link
        href="/assistant"
        className={cn(
          "group mt-6 rounded-2xl bg-forest p-4 text-cream shadow-lift transition hover:bg-forest-700",
          pathname.startsWith("/assistant") && "ring-2 ring-sage ring-offset-2 ring-offset-cream",
        )}
      >
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          <Sparkles className="h-4 w-4 text-terracotta" /> Ask Peloton
        </span>
        <span className="mt-1 block text-[12.5px] leading-snug text-cream/70">“Date night in Amsterdam my friends loved?”</span>
      </Link>

      <div className="mt-auto space-y-3">
        {mode === "demo" && (
          <div className="rounded-xl border border-dashed border-terracotta/40 bg-terracotta-50/60 p-3 text-[12px] leading-snug text-[#8a4e33]">
            <p className="font-semibold">Demo mode</p>
            <p className="mt-0.5 text-[#8a4e33]/80">All people, places and reviews are fictional sample data stored in your browser.</p>
            <button
              onClick={() => {
                resetDemoData();
                location.reload();
              }}
              className="mt-2 inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
            >
              <RotateCcw className="h-3 w-3" /> Reset demo
            </button>
          </div>
        )}
        {me && (
          <Link href="/profile" className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/60">
            <Avatar user={me} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-semibold">{me.fullName}</span>
              <span className="block truncate text-[12px] text-muted">@{me.username}</span>
            </span>
          </Link>
        )}
      </div>
    </aside>
  );
}

function MobileTopBar() {
  const unread = useUnreadCount();
  const pathname = usePathname();
  if (pathname.startsWith("/map") || pathname.startsWith("/place/")) return null;
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-cream-300/60 bg-cream/85 px-4 backdrop-blur-xl lg:hidden">
      <Link href="/">
        <Logo />
      </Link>
      <div className="flex items-center gap-1">
        <Link href="/assistant" className="grid h-10 w-10 place-items-center rounded-full text-forest hover:bg-cream-200" aria-label="Ask Peloton AI">
          <Sparkles className="h-5 w-5" />
        </Link>
        <Link href="/notifications" className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-cream-200" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-terracotta ring-2 ring-cream" />}
        </Link>
      </div>
    </header>
  );
}

function BottomNav() {
  const pathname = usePathname();
  const { me } = useStore();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-cream-300/70 bg-cream/90 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex h-16 max-w-md items-stretch justify-around">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} className={cn("flex flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-medium transition", active ? "text-forest" : "text-charcoal/55")}>
              {href === "/profile" && me ? (
                <Avatar user={me} size="xs" className={cn(active && "ring-2 ring-forest ring-offset-1 ring-offset-cream")} />
              ) : (
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.3 : 1.8} />
              )}
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { ready, loadError, actions } = useStore();
  return (
    <div className="min-h-dvh">
      <Sidebar />
      <MobileTopBar />
      <main className="pb-24 lg:pb-0 lg:pl-[248px]">
        {loadError ? (
          <div className="mx-auto max-w-md px-6 py-24 text-center">
            <p className="text-lg font-semibold">We couldn&apos;t load your Peloton.</p>
            <p className="mt-2 text-sm text-muted">{loadError}</p>
            <button onClick={() => actions.reload()} className="mt-6 rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-cream">
              Try again
            </button>
          </div>
        ) : ready ? (
          children
        ) : (
          <ShellSkeleton />
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <div className="skeleton h-10 w-72 rounded-xl" />
      <div className="mt-8 flex gap-4 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton aspect-[4/5] w-[280px] shrink-0 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
