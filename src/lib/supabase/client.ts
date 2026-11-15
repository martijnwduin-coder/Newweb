"use client";
import { createBrowserClient } from "@supabase/ssr";
import { config } from "../config";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowser() {
  if (!client) client = createBrowserClient(config.supabaseUrl, config.supabaseAnonKey);
  return client;
}
