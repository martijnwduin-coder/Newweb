"use client";

import {
  Activity,
  BarChart3,
  Dumbbell,
  Eye,
  Flame,
  Footprints,
  Globe2,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  Shirt,
  Sparkles,
  Sun,
  Trophy,
  Wind,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/deals", label: "Best Deals", icon: Flame },
  { href: "/c/air-force-1", label: "Air Force 1", icon: Sparkles },
  { href: "/c/air-max", label: "Air Max", icon: Wind },
  { href: "/c/running", label: "Running", icon: Footprints },
  { href: "/c/basketball", label: "Basketball", icon: Trophy },
  { href: "/c/training", label: "Training", icon: Dumbbell },
  { href: "/c/other", label: "Other Nike", icon: Activity },
  { href: "/c/apparel", label: "Apparel", icon: Shirt },
  { href: "/compare", label: "Price Comparison", icon: Globe2 },
  { href: "/watchlist", label: "Watchlist", icon: Eye },
  { href: "/history", label: "Price History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function useTheme(): [string, (t: string) => void] {
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);
  const set = (t: string) => {
    setTheme(t);
    document.documentElement.classList.toggle("dark", t === "dark");
    try {
      localStorage.setItem("ndt-theme", t);
    } catch {}
  };
  return [theme, set];
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((n, i) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        const Icon = n.icon;
        return (
          <div key={n.href}>
            {(i === 2 || i === 9 || i === 12) && <div className="my-2 h-px bg-border" />}
            <Link
              href={n.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                active ? "bg-panel-2 font-medium text-text" : "text-muted hover:bg-panel-2/60 hover:text-text",
              )}
            >
              <Icon className={cn("size-4", active ? "text-accent" : "")} />
              {n.label}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 px-1">
      <div className="grid size-7 place-items-center rounded-lg bg-accent text-white">
        <BarChart3 className="size-4" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight">Nike Deal Tracker</div>
        <div className="text-[11px] text-muted">Zalando · 5 markets</div>
      </div>
    </Link>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };
  const footer = (
    <div className="flex items-center gap-1 border-t border-border pt-3">
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="flex h-8 flex-1 items-center gap-2 rounded-lg px-2.5 text-sm text-muted hover:bg-panel-2 hover:text-text"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </button>
      <button onClick={logout} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-text" aria-label="Sign out" title="Sign out">
        <LogOut className="size-4" />
      </button>
    </div>
  );
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-5 border-r border-border bg-panel px-3 py-4 lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto scrollbar-none">
          <NavLinks />
        </div>
        {footer}
      </aside>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-bg/85 px-4 backdrop-blur lg:hidden">
        <Brand />
        <button onClick={() => setOpen(true)} className="grid size-9 place-items-center rounded-lg border border-border" aria-label="Open menu">
          <Menu className="size-4" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col gap-5 bg-panel px-3 py-4 shadow-xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-lg" aria-label="Close menu">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            {footer}
          </div>
        </div>
      )}
      <main className="lg:pl-60">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
