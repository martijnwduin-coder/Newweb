import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Category } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = "id") {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix === "uuid" ? rand : `${prefix}_${rand}`;
}

export function formatRating(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "–";
  return value.toFixed(1);
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.round(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function priceLabel(level?: number | null) {
  if (!level) return null;
  return "€".repeat(Math.max(1, Math.min(4, Math.round(level))));
}

export const CATEGORY_META: Record<Category, { label: string; plural: string; color: string }> = {
  restaurant: { label: "Restaurant", plural: "Restaurants", color: "#0F0F0E" },
  coffee: { label: "Coffee", plural: "Coffee", color: "#7A4A2E" },
  cafe: { label: "Café", plural: "Cafés", color: "#5E6B57" },
  bakery: { label: "Bakery", plural: "Bakeries", color: "#FF5C28" },
  bar: { label: "Bar", plural: "Bars", color: "#3A3550" },
};

export const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

const AVATAR_TONES = ["#0F0F0E", "#FF5C28", "#5E6B57", "#7A4A2E", "#3A3550", "#2F4F5C", "#8C7B6B"];
export function avatarTone(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

/** Haversine distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function directionsUrl(p: { lat: number; lng: number; googlePlaceId?: string | null; name: string }) {
  const params = new URLSearchParams({ api: "1", destination: `${p.lat},${p.lng}` });
  if (p.googlePlaceId) params.set("destination_place_id", p.googlePlaceId);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function siteOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}
