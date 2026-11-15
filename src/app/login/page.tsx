"use client";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { isSupabaseConfigured } from "@/lib/config";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=70" alt="" className="h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
        <div className="absolute bottom-0 p-12 text-paper">
          <p className="display max-w-md text-[48px]">Discover places through people, not algorithms.</p>
          <p className="mt-4 text-paper/70">Good places. Better connections.</p>
        </div>
      </div>
      <div className="flex flex-col justify-center px-6 py-12 sm:px-16">
        <Logo />
        <Suspense>
          <AuthForm />
        </Suspense>
      </div>
    </div>
  );
}

function AuthForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(params.get("error") ? "Sign-in link expired or was invalid. Please try again." : null);

  if (!isSupabaseConfigured) {
    return (
      <div className="mt-12 max-w-sm">
        <h1 className="display text-[36px] text-ink">Welcome to the table.</h1>
        <p className="mt-3 text-muted">
          Authentication isn&apos;t connected yet. Add your Supabase URL and anon key to enable accounts — until then, explore the full app with clearly-labelled demo data.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/">
            Continue in demo mode <ArrowRight />
          </Link>
        </Button>
      </div>
    );
  }

  const sb = getSupabaseBrowser();
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res =
      mode === "signin"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo, data: { full_name: name } } });
    setBusy(false);
    if (res.error) return setMessage(res.error.message);
    if (mode === "signup" && !res.data.session) return setMessage("Check your inbox to confirm your email.");
    window.location.href = next;
  };

  return (
    <div className="mt-12 w-full max-w-sm">
      <h1 className="display text-[36px] text-ink">{mode === "signin" ? "Welcome back." : "Pull up a chair."}</h1>
      <p className="mt-2 text-muted">{mode === "signin" ? "Sign in to see where your friends are going." : "Create your Peloton in seconds."}</p>

      <Button variant="outline" size="lg" className="mt-8 w-full" onClick={() => sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.5Z" />
          <path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3a11.5 11.5 0 0 0 10.2 6.3Z" />
          <path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4l3.8-3Z" />
          <path fill="#EA4335" d="M12 5.1c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.5 11.5 0 0 0 1.8 6.8l3.8 3C6.5 7.1 9 5.1 12 5.1Z" />
        </svg>
        Continue with Google
      </Button>
      <div className="my-6 flex items-center gap-3 text-[12px] text-muted">
        <span className="h-px flex-1 bg-paper-300" /> or with email <span className="h-px flex-1 bg-paper-300" />
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === "signup" && (
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </div>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required />
        </div>
        {message && <p className="rounded-xl bg-accent-50 px-3 py-2 text-[13px] text-[#A3360D]">{message}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} {mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <div className="mt-4 flex items-center justify-between text-[13px]">
        <button
          className="inline-flex items-center gap-1 text-muted hover:text-charcoal"
          onClick={async () => {
            if (!email) return setMessage("Enter your email first.");
            const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
            setMessage(error ? error.message : "Magic link sent — check your inbox.");
          }}
        >
          <Mail className="h-3.5 w-3.5" /> Email me a magic link
        </button>
        <button className="font-medium text-ink" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "Create account" : "I have an account"}
        </button>
      </div>
    </div>
  );
}
