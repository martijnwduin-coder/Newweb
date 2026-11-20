"use client";

import { BarChart3, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function LoginForm() {
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    if (res.ok) {
      const next = sp.get("next") || "/";
      window.location.href = next.startsWith("/") && !next.startsWith("//") ? next : "/";
      return;
    }
    const body = await res.json().catch(() => ({}));
    setError(body.detail || "Sign-in failed");
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-panel p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-2.5">
        <div className="grid size-9 place-items-center rounded-xl bg-accent text-white">
          <BarChart3 className="size-5" />
        </div>
        <div>
          <div className="font-semibold tracking-tight">Nike Deal Tracker</div>
          <div className="text-xs text-muted">Sign in to your dashboard</div>
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</div>}
        <Button type="submit" variant="accent" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Sign in
        </Button>
      </div>
    </form>
  );
}
