"use client";
import { ArrowLeft, LogOut, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { VISIBILITY_META } from "@/components/collections/add-to-collection";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { resetDemoData } from "@/lib/backend/demo";
import { useStore } from "@/lib/store/store";
import type { PrivacySettings, Visibility } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRIVACY_ROWS: { key: keyof PrivacySettings; label: string; hint: string }[] = [
  { key: "profile", label: "Profile", hint: "Who can see your bio, taste identity and activity" },
  { key: "reviews", label: "Reviews & ratings", hint: "Who sees your reviews (they count toward ratings only for those people)" },
  { key: "saved", label: "Saved places", hint: "Who can see what you've bookmarked" },
];

export default function SettingsPage() {
  const { me, mode, actions } = useStore();
  const [form, setForm] = useState(() => ({
    fullName: me?.fullName ?? "",
    username: me?.username ?? "",
    bio: me?.bio ?? "",
    location: me?.location ?? "",
  }));
  const [privacy, setPrivacy] = useState<PrivacySettings>(me?.privacy ?? { profile: "public", saved: "friends", reviews: "public" });
  if (!me) return null;
  const usernameValid = /^[a-z0-9_.]{3,30}$/.test(form.username);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-8 lg:pt-12">
      <Link href="/profile" className="inline-flex items-center gap-1.5 text-[14px] text-muted hover:text-charcoal">
        <ArrowLeft className="h-4 w-4" /> Profile
      </Link>
      <h1 className="display mt-4 text-[36px] text-forest">Settings</h1>

      <form
        className="mt-8 space-y-10"
        onSubmit={(e) => {
          e.preventDefault();
          if (!usernameValid) return;
          actions.updateProfile({ ...form, privacy });
        }}
      >
        <section className="space-y-4 rounded-3xl bg-white p-6 shadow-soft">
          <div className="flex items-center gap-4">
            <Avatar user={{ ...me, fullName: form.fullName || me.fullName }} size="lg" />
            <div>
              <p className="font-semibold">Profile</p>
              <p className="text-[13px] text-muted">How friends find and recognise you.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} maxLength={80} />
            </div>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} aria-invalid={!usernameValid} className={cn(!usernameValid && "border-terracotta")} />
              {!usernameValid && <p className="mt-1 text-[12px] text-[#a14b2c]">3–30 characters: a–z, 0–9, _ or .</p>}
            </div>
          </div>
          <div>
            <Label htmlFor="location">Location (optional)</Label>
            <Input id="location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Amsterdam" />
          </div>
          <div>
            <Label htmlFor="bio">Short bio</Label>
            <Textarea id="bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={280} />
            <p className="mt-1 text-right text-[12px] text-muted">{form.bio.length}/280</p>
          </div>
        </section>

        <section className="space-y-5 rounded-3xl bg-white p-6 shadow-soft">
          <div>
            <p className="font-semibold">Privacy</p>
            <p className="text-[13px] text-muted">You decide who sees what. Enforced by row-level security in the database.</p>
          </div>
          {PRIVACY_ROWS.map((row) => (
            <div key={row.key}>
              <p className="text-[14px] font-medium">{row.label}</p>
              <p className="mb-2 text-[12.5px] text-muted">{row.hint}</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(VISIBILITY_META) as Visibility[]).map((v) => {
                  const M = VISIBILITY_META[v];
                  const on = privacy[row.key] === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPrivacy({ ...privacy, [row.key]: v })}
                      className={cn("flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition", on ? "border-forest bg-forest-50" : "border-cream-300 hover:border-sage")}
                      aria-pressed={on}
                    >
                      <M.icon className={cn("h-4 w-4", on ? "text-forest" : "text-muted")} />
                      <span className="text-[13.5px] font-medium">{M.label}</span>
                      <span className="text-[11.5px] leading-tight text-muted">{M.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={!usernameValid}>
            Save changes
          </Button>
          {mode === "live" ? (
            <Button type="button" variant="ghost" onClick={() => actions.signOut()}>
              <LogOut /> Sign out
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (confirm("Reset all demo data to its original state?")) {
                  resetDemoData();
                  location.href = "/";
                }
              }}
            >
              <RotateCcw /> Reset demo data
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
