"use client";
import { ArrowUp, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Centered composer: sends the question to the assistant. */
export function AskBox({ placeholder = "Ask for a place, or search anything", autoFocus, onSubmit, busy, className }: { placeholder?: string; autoFocus?: boolean; onSubmit?: (q: string) => void; busy?: boolean; className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const send = () => {
    const v = q.trim();
    if (!v || busy) return;
    if (onSubmit) {
      onSubmit(v);
      setQ("");
    } else router.push(`/assistant?q=${encodeURIComponent(v)}`);
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className={cn("rounded-[22px] border border-black/[0.08] bg-white p-3 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] transition focus-within:border-black/20", className)}
    >
      <textarea
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        rows={2}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label="Ask Peloton"
        className="block w-full resize-none bg-transparent px-1.5 pt-1 text-[16px] text-ink placeholder:text-[#a3a3a3] focus:outline-none"
      />
      <div className="mt-1 flex items-center justify-between">
        <Link href="/map" className="grid h-8 w-8 place-items-center rounded-full border border-black/10 text-ink hover:bg-paper-200" aria-label="Explore the map">
          <Plus className="h-4 w-4" />
        </Link>
        <button
          type="submit"
          disabled={!q.trim() || busy}
          aria-label="Send"
          className={cn("grid h-8 w-8 place-items-center rounded-full transition", q.trim() && !busy ? "bg-ink text-white" : "bg-black/[0.06] text-black/30")}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
