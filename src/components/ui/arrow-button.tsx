import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Pill CTA with a round accent arrow that turns on hover. */
export function ArrowButton({
  href,
  children,
  tone = "light",
  className,
  onClick,
}: {
  href?: string;
  children: React.ReactNode;
  tone?: "light" | "dark" | "outline";
  className?: string;
  onClick?: () => void;
}) {
  const cls = cn(
    "group inline-flex h-12 items-center gap-3 rounded-full py-1.5 pl-6 pr-1.5 text-[14.5px] font-medium transition-colors duration-300",
    tone === "light" && "bg-paper text-ink hover:bg-white",
    tone === "dark" && "bg-ink text-paper hover:bg-black",
    tone === "outline" && "border border-current/25 text-current hover:border-current/60",
    className,
  );
  const inner = (
    <>
      <span>{children}</span>
      <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-ink transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-45">
        <ArrowUpRight className="h-4 w-4" />
      </span>
    </>
  );
  if (href)
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
