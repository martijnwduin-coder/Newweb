"use client";
import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Display-only stars with half-star precision. */
export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-cream-300" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="text-terracotta" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Interactive 1–5 rating with half steps (click left/right half of a star). */
export function StarInput({ value, onChange, size = 32, label }: { value: number | null; onChange: (v: number | null) => void; size?: number; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex" role="radiogroup" aria-label={label} onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = Math.max(0, Math.min(1, shown - (i - 1)));
          return (
            <span key={i} className="relative" style={{ width: size + 4, height: size }}>
              <Star className="absolute left-0.5 top-0 text-cream-300" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
              <span className="absolute left-0.5 top-0 overflow-hidden transition-[width]" style={{ width: fill * size }}>
                <Star className="text-terracotta" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
              </span>
              {[i - 0.5, i].map((v, half) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={value === v}
                  aria-label={`${v} stars`}
                  className={cn("absolute top-0 h-full w-1/2 cursor-pointer", half ? "right-0" : "left-0")}
                  onMouseEnter={() => setHover(v < 1 ? 1 : v)}
                  onClick={() => onChange(v < 1 ? 1 : value === v ? null : v)}
                />
              ))}
            </span>
          );
        })}
      </div>
      <span className="w-8 text-sm font-semibold tabular-nums text-charcoal">{shown ? shown.toFixed(1) : "–"}</span>
    </div>
  );
}
