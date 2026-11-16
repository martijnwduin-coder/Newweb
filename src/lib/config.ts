// Feature flags derived from environment variables.
// NEXT_PUBLIC_* values are safe to expose to the browser; everything else is server-only.

export const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  googleMapsBrowserKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  googleMapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
};

/** Live backend is used only when both Supabase values are present. */
export const isSupabaseConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);

/** Real Google map in the browser. Without it a stylised demo map is rendered. */
export const isGoogleMapsConfigured = Boolean(config.googleMapsBrowserKey);

export const appMode: "demo" | "live" = isSupabaseConfigured ? "live" : "demo";

/** Static build (GitHub Pages): no server, so no API routes, auth or share pages. */
export const isStaticSite = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";

/** Path prefix when hosted in a sub-folder, e.g. "/Newweb" on GitHub Pages. */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
