"use client";
import { createDemoDatabase, DEMO_ME_ID } from "../demo/seed";
import type { Database } from "../types";
import type { Backend } from "./types";

const KEY = "peloton-demo-db-v1";

/** Downscale an image to a JPEG data URL so demo photos fit in localStorage. */
async function fileToDataUrl(file: File, max = 1000): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.78);
}

const noop = async () => {};

export const demoBackend: Backend = {
  mode: "demo",
  async load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { db: JSON.parse(raw) as Database, meId: DEMO_ME_ID };
    } catch {
      // ignore corrupt / unavailable storage
    }
    return { db: createDemoDatabase(), meId: DEMO_ME_ID };
  },
  persist(db) {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      // Quota exceeded or storage blocked — demo keeps working in memory.
    }
  },
  async upsertPlace(place) {
    return place;
  },
  upsertReview: noop,
  deleteReview: noop,
  async uploadPhoto(file) {
    return fileToDataUrl(file);
  },
  setSaved: noop,
  upsertCollection: noop,
  deleteCollection: noop,
  setCollectionPlaces: noop,
  setCollectionFollow: noop,
  upsertFriendship: noop,
  deleteFriendship: noop,
  setFollow: noop,
  sendRecommendation: noop,
  markNotificationsRead: noop,
  updateProfile: noop,
};

export function resetDemoData() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
