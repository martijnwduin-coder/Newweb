import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Compact call-to-action button with a trailing arrow. */
export function ArrowButton({
  href,
  children,
  tone = "dark",
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
    "group inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-[14px] font-medium transition-colors",
    tone === "dark" && "bg-ink text-white hover:bg-black",
    tone === "light" && "bg-white text-ink hover:bg-paper-200",
    tone === "outline" && "border border-black/10 bg-white text-ink hover:bg-paper-200",
    className,
  );
  const inner = (
    <>
      {children}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
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
