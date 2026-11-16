# Peloton AI

**Good places. Better connections.** A social restaurant and coffee discovery app. You find places through people you trust, not through algorithms.

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui-style components (Radix + CVA) · Lucide · Supabase (Postgres, Auth, Storage, RLS) · Google Maps JS + Places API (New) · Anthropic Claude.

## Quick start (website + backend on your computer)

You need **Node.js 20+** and **Docker Desktop**, and Docker Desktop must be running.

```bash
npm install
npm run db:start      # first run downloads the database images (a few minutes)
npm run db:seed       # adds the fictional demo people, places and reviews
npm run build
npm start
```

Open http://localhost:3000 and sign in with **alex@peloton.demo / peloton-demo**.

The included `.env.local` points the app at this local backend. If you delete it, the app runs in demo mode in the browser, without Docker.

To stop the backend, run `npm run db:stop`.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional: leave blank for demo mode
npm run dev                  # http://localhost:3000
```

If no keys are set, the app runs in **demo mode**. All people, places and reviews in it are fictional sample data, marked with "Demo" badges, and your changes are saved in your browser's localStorage. You can reset the demo from the footer or from Settings.

## Run the full stack locally (frontend + backend)

The backend is Supabase (Postgres, Auth, REST, Storage). The CLI runs it locally in Docker:

```bash
npm run db:start        # starts Postgres/Auth/REST/Storage, applies supabase/migrations
npx supabase status -o env   # shows API_URL, ANON_KEY, SERVICE_ROLE_KEY
```

Create `.env.local`:

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from supabase status>
```

Seed the demo people, places and reviews (fictional), then start the app:

```bash
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY> npm run db:seed
npm run build && npm start
```

Sign in as `alex@peloton.demo` / `peloton-demo` (every demo person has an account: `emma@`, `thomas@`, `sarah@`…). `npm run db:reset` wipes and re-migrates; run the seed again afterwards. `npm run db:stop` stops the containers.

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

## Tests

```bash
npm test            # unit tests (recommendation engine, privacy rules, clustering, rate limiting)
npm run test:e2e    # browser tests; live-mode suite if .env.local points at Supabase, demo-mode suite otherwise
```

GitHub Actions (`.github/workflows/ci.yml`) runs lint, type-check, unit tests, the production build and the demo-mode browser tests on every push.

## Live updates & protection

- **Realtime:** new notifications, friend requests and recommendations arrive without a refresh, through Supabase Realtime (migration `0002_realtime.sql`).
- **Rate limits** per IP on the paid endpoints: AI assistant 12/min, Places search 30/min, photos 150/min, share cards 60/min. The limiter is in-memory, so each server instance keeps its own count. Use Redis or Upstash for a global limit.
- **Security headers** are set in `next.config.ts`. Anti-framing and HSTS apply only on Vercel, or when `PELOTON_STRICT_HEADERS=1`.

## Deploy

Push to GitHub, import the repo in Vercel, add the env vars and set `NEXT_PUBLIC_SITE_URL` to your production URL.
