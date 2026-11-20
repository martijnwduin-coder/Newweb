import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export function SampleBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div>
        <b>SAMPLE DATA.</b> Everything shown is fictional test data for checking the interface, not prices from Zalando. It disappears
        automatically once a real scan has collected products (or run <code className="font-mono">python -m app.cli purge-sample</code>).
      </div>
    </div>
  );
}

export function NotOperationalBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-panel px-4 py-3 text-sm">
      <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted" />
      <div>
        <b>Not operational yet.</b> No real product data has been collected. Run a scan from{" "}
        <Link href="/settings#scans" className="underline">
          Settings → Scans
        </Link>
        .
      </div>
    </div>
  );
}

export function ScanStatus({ status }: { status: string }) {
  const map: Record<string, { tone: "good" | "warn" | "bad" | "neutral" | "accent"; icon: React.ReactNode }> = {
    success: { tone: "good", icon: <CheckCircle2 className="size-3" /> },
    partial: { tone: "warn", icon: <AlertTriangle className="size-3" /> },
    failed: { tone: "bad", icon: <XCircle className="size-3" /> },
    blocked: { tone: "bad", icon: <XCircle className="size-3" /> },
    skipped: { tone: "neutral", icon: <CircleDashed className="size-3" /> },
    running: { tone: "accent", icon: <Loader2 className="size-3 animate-spin" /> },
    sent: { tone: "good", icon: <CheckCircle2 className="size-3" /> },
    pending: { tone: "accent", icon: <Loader2 className="size-3 animate-spin" /> },
  };
  const m = map[status] ?? { tone: "neutral" as const, icon: null };
  return (
    <Badge tone={m.tone}>
      {m.icon}
      {status}
    </Badge>
  );
}
