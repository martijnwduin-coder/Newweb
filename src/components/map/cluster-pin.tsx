import { cn } from "@/lib/utils";

export function ClusterPin({ count, friend }: { count: number; friend?: boolean }) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-full bg-ink font-semibold text-white shadow-lift ring-4 transition-transform hover:scale-110",
        friend ? "ring-accent/30" : "ring-white/80",
        count >= 10 ? "h-12 w-12 text-[15px]" : "h-10 w-10 text-[14px]",
      )}
    >
      {count}
    </div>
  );
}
