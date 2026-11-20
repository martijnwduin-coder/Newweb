# Nike Deal Tracker — Zalando Europe

A personal discount-intelligence platform. It monitors Nike (and Jordan) products on
Zalando **Netherlands, Germany, France, Spain and Poland** and identifies discounts and
price drops. It compares the same SKU across the five countries, keeps a full price
history, and emails a ranked report every **Monday at 08:00 Europe/Amsterdam**.

```
            ┌─────────────── GitHub Actions (cron, hourly on Monday mornings) ───────────────┐
            │  python -m app.cli tick  →  due?  →  scan 5 countries  →  report  →  email      │
            └──────────────────────────────────────────┬─────────────────────────────────────┘
                                                       │
  Zalando NL/DE/FR/ES/PL ──► connectors ──► classifier ──► pricing ──► PostgreSQL (Supabase/Neon)
  (public pages or                                                          ▲
   authorised feed)                                                         │
                         Next.js dashboard (Vercel) ──► /api proxy ──► FastAPI (Render / Docker)
```

| Part | Tech | Where |
|---|---|---|
| Data collection | Python, httpx; modular per-country connectors | `backend/app/connectors/` |
| Identification | Zalando config SKU + multilingual franchise/category classifier | `backend/app/catalog/` |
| Pipeline | scan → validate → history → events → current price | `backend/app/scanner.py` |
| API | FastAPI, JWT auth, rate limiting, health checks | `backend/app/main.py`, `api/routes.py` |
| Database | PostgreSQL (SQLite for tests/local), SQLAlchemy 2 | `backend/app/models.py` |
| Report & email | Jinja2 HTML + text, Resend or SMTP, retries, delivery log | `backend/app/report/`, `emailer.py` |
| Scheduler | GitHub Actions cron + DST-aware `tick`, or in-process for Docker | `.github/workflows/nike-weekly-scan.yml`, `scheduler.py` |
| Dashboard | Next.js 15, React 19, TypeScript, Tailwind v4, shadcn-style UI, Recharts | `frontend/` |

## How data is collected (and why it is compliant)

Two connector types can be chosen per country (`CONNECTOR_NL=…`, or per country in Settings):

1. **`zalando_web`** (default) reads the same public catalogue and product pages a browser sees.
   * It checks robots.txt for every URL. As of November 2026 Zalando allows brand catalogue
     pages, `?p=`/`?order=`/`?q=` parameters and product pages, and disallows `/api/*`. The
     connector never calls `/api/*`.
   * It waits at least 4 s between requests to a host, with a fixed page budget per scan
     (about 170 requests per country), and caches pages on disk.
   * It sends an honest User-Agent (`NikeDealTracker/1.0 …`). It does not spoof a browser or
     rotate IPs, and it never bypasses CAPTCHAs or other protection. Any 401/403 or bot
     challenge stops that country immediately and is logged as `blocked`.
   * Crawl plan: `/nike/?order=sale` and `/jordan/?order=sale` (biggest discounts first), then a
     search per priority franchise (`?q=Air Force 1` …), then popular pages. After that it
     visits product pages for priority products to get verified sizes, stock and shipping.
2. **`feed`** is an authorised affiliate product feed (Zalando's partner programme, e.g. on Awin).
   It has complete coverage with no crawling and is the most robust choice if a country ever
   starts blocking `zalando_web`. Put the feed download URL in `FEED_URL_XX`.

A third connector, **`sample`**, produces fictional data for testing the interface. It is
flagged *SAMPLE DATA* everywhere and is automatically hidden as soon as real data exists.

### Price integrity

* Prices are only stored when they are explicit. Zalando's minor-unit amounts are used only
  after cross-checking them against the major-unit amount on the same page. Otherwise the
  formatted text ("119,95 €") is parsed. If a price can't be verified it is rejected, not guessed.
* `Discount % = (original − current) / original × 100`. The original price is the shop's own
  crossed-out price. Its label (e.g. *Normale prijs*, *Vorige laagste prijs*, *Cena regularna*)
  is stored and shown.
* Under EU price-indication rules, Zalando sometimes shows a second reference: the lowest price
  of the previous 30 days. It is stored separately, and the dashboard shows both figures
  (e.g. "−70% vs regular price · −14% vs 30-day low").
* PLN is kept as the original currency and converted to EUR at the ECB reference rate fetched
  at the start of each scan. The rate is stored with every observation. Without a rate less
  than 7 days old, Poland is not stored at all.
* Sanity checks reject non-positive prices, prices above €10,000 and "discounts" above 95%.
  A failed or partial scan never overwrites a valid price and never deletes history.

### Identity and duplicates

A product is a **Zalando config SKU** (e.g. `NI112N022-A11`), which is one model in one colourway.
The same SKU is used by all five shops, which makes cross-country comparison exact.
Each country listing is a `product_variant`. Each scan stores at most one observation per
variant (unique constraint). The franchise classifier recognises names in all five languages
(`AIR FORCE 1 '07`, `AF1`, `Air Force 1 Low` → *Air Force 1*) without merging colourways.

## Features

* **Overview**: tracked products, discounted, 30%+, new this week, biggest discount,
  cheapest deal, last and next scan, country table, watchlist alerts, top deals.
* **Best Deals**, plus Air Force 1 / Air Max / Running / Basketball / Training / Other / Apparel pages.
  * Sort by: ranked score, discount, price, € saving, price drop, newest, franchise, country.
  * Filter by: discount, country, franchise, size, gender, category, search, "new this week",
    and in stock only.
* **Price Comparison**: same SKU across NL/DE/FR/ES/PL in EUR with the original currency,
  cheapest country, price spread, and "discounted in some countries only".
* **Price History**: chart per country (price or discount %) with a table view; lowest,
  highest and average price; and the "all-time low", "below 30-day average" and "below
  90-day average" claims. These claims are only made with enough observations (3 over 14
  days, or 4 over 45 days).
* **Watchlist**: follow products, franchises, colourways and sizes, per country. Optionally
  alert on a minimum discount or a maximum price (e.g. "any Air Force 1 at 40% off", "Shox TL
  below €80", "Vomero Plus in size 44"). Watched items are starred everywhere and listed in the email.
* **Settings**: schedule (day, time, time zone), recipient, report threshold, failure emails,
  test email, report preview, scan log with per-country details, *Run scan now*, connector per
  country, franchise list (add new franchises at runtime), email delivery log, ECB rates and
  password change.
* **Weekly email**: sections A–G as specified (overview, Top 20 ranked, Air Force 1 special,
  priority franchises, country comparison, price drops, watchlist alerts). If nothing
  reaches the threshold, it says so instead of padding the list.

Ranking for the Top 20: `discount % + 0.25 × € saving (max 100) + desirability (P1 +15, P2 +7) + 5 if cheapest country + 0.75 per size in stock (max 8) − 50 if sold out`.

## Local development

```bash
cd nike-deal-tracker/backend
pip install -r requirements-dev.txt
export ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=change-me-please
python -m app.cli init
python -m app.cli scan --country NL          # real data, ~170 polite requests (~12 min)
# or: python -m app.cli seed-sample           # fictional, clearly-labelled data for UI work
uvicorn app.main:app --reload                 # http://localhost:8000/docs

cd ../frontend
npm install
BACKEND_URL=http://localhost:8000 npm run dev # http://localhost:3000
```

Tests: `python -m pytest` (130 tests; set `TEST_DATABASE_URL=postgresql://…` to run them on
PostgreSQL). Frontend: `npm run typecheck && npm run build`.

Useful CLI commands: `probe` (checks reachability and robots.txt with 2 requests per country),
`fx`, `report --out report.html`, `report --send --to you@example.com`, `weekly`, `tick`,
`purge-sample` and `create-user`.

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for production setup, email and the Monday automation.
