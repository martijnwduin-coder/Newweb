"use client";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function SearchBar({ className, initial = "", large }: { className?: string; initial?: string; large?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `/map?q=${encodeURIComponent(q.trim())}` : "/map");
      }}
      className={cn("relative", className)}
    >
      <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find your next favorite place..."
        aria-label="Search places"
        className={cn(
          "w-full rounded-full border border-paper-300 bg-white pl-11 pr-4 text-[15px] shadow-soft transition placeholder:text-muted/80 focus:border-stone focus:outline-none focus:ring-4 focus:ring-stone/25",
          large ? "h-14 text-base" : "h-12",
        )}
      />
    </form>
  );
}
