# Peloton AI

**Good places. Better connections.** A social restaurant and coffee discovery app. You find places through people you trust, not through algorithms.

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui-style components (Radix + CVA) · Lucide · Supabase (Postgres, Auth, Storage, RLS) · Google Maps JS + Places API (New) · Anthropic Claude.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional: leave blank for demo mode
npm run dev                  # http://localhost:3000
```

If no keys are set, the app runs in **demo mode**. All people, places and reviews in it are fictional sample data, marked with "Demo" badges, and your changes are saved in your browser's localStorage. You can reset the demo from the sidebar or from Settings.

## Connect real services

| Service | Env vars | Steps |
|---|---|---|
| **Supabase** (live data + auth) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Create a project. Run `supabase/migrations/0001_init.sql` in the SQL editor (or `supabase db push`). Under Auth, set Site URL to your domain and add `<domain>/auth/callback` as a redirect URL. To use Google sign-in, enable the Google provider. Once both vars are set, the app switches to live mode and requires sign-in. |
| **Google Maps** (map) | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, optional `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | Enable *Maps JavaScript API*. Restrict the key to your HTTP referrers. To style the map, create a Map ID in Cloud Console; without one, Google's `DEMO_MAP_ID` is used. If no key is set, a stylised demo map is shown instead. |
| **Google Places** (search any venue) | `GOOGLE_PLACES_API_KEY` (server only) | Enable *Places API (New)*. The key stays server-side: search goes through `/api/places/search` and photos through `/api/places/photo`. |
| **AI assistant** | `ANTHROPIC_API_KEY` (server only) | Optional. Without it, the deterministic recommendation engine answers on its own. |

## Architecture

- `src/lib/types.ts`: domain model (mirrors the SQL schema)
- `src/lib/selectors.ts`: pure read logic (privacy checks, friend picks, community ranking, activity feed, taste profile)
- `src/lib/store/store.tsx`: client store with optimistic mutations, backed by a `Backend` port
  - `backend/demo.ts`: localStorage
  - `backend/supabase.ts`: Supabase, with RLS enforcing ownership
- `src/lib/ai/engine.ts`: grounded recommendation engine. Every candidate and reason comes from real rows.
- `src/lib/ai/llm.ts` + `/api/ai/discover`: Claude re-ranks and narrates engine candidates using structured output. Returned IDs are checked against the candidate list, so the model can't invent places or ratings.
- `src/lib/places/google.ts`: Places API (New) client (server only)
- `/api/share-card`: branded PNG share cards (story, square and Open Graph sizes)
- `/share/[kind]/[id]`: public, server-rendered share pages

Ratings shown in the app are always labelled. A **Peloton community rating** comes from app members. A Google rating is shown separately, marked "G … on Google", and is never mixed with Peloton ratings.

## Database

The tables are `profiles` (the spec's `users`, keyed to `auth.users`), `places`, `reviews` (unique per user + place, so editing replaces the review), `review_photos`, `friendships`, `follows`, `collections`, `collection_places`, `collection_follows`, `saved_places`, `place_recommendations` and `notifications`.

Notifications are written by database triggers. RLS uses the `can_view(owner, visibility)` helper to apply public / friends / private visibility.

## Deploy

Push to GitHub, import the repo in Vercel, add the env vars and set `NEXT_PUBLIC_SITE_URL` to your production URL.
