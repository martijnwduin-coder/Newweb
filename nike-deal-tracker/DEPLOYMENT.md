# Deployment, email and Monday automation

The recommended setup costs **€0/month** and keeps working when your computer is off:

| Piece | Service (free tier) | Why |
|---|---|---|
| Database | **Supabase** or **Neon** PostgreSQL | managed Postgres, daily backups on paid plans, dashboard |
| Weekly scan + email | **GitHub Actions** (`.github/workflows/nike-weekly-scan.yml`) | persistent cron, up to 6 h per run, logs and failure emails built in |
| API | **Render** (Docker, free) or Railway/Fly | serves the dashboard; may sleep, which doesn't matter for scans |
| Dashboard | **Vercel** (Hobby) | Next.js host |
| Email | **Resend** (3,000 emails/month free) or any SMTP server | delivery API with logs |

Alternative: everything on one always-on machine with `docker compose` (section 7).

---

## 1. Database

**Supabase:** create a project, then go to **Project Settings → Database → Connection string → URI**.
Use the **Session pooler** (port 5432) or the direct connection. The transaction pooler on port
6543 is not recommended. The string looks like:
`postgresql://postgres.xxxx:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`

Create the tables and your user once, from any machine with Python 3.12:

```bash
cd nike-deal-tracker/backend
pip install -r requirements.txt
export DATABASE_URL='postgresql://…'  ADMIN_EMAIL='you@example.com'  ADMIN_PASSWORD='a-long-password'
python -m app.cli init
```

(The API also does this automatically on first start.)

## 2. API on Render

1. In Render, choose **New → Web Service → Build from a Git repository**. Pick this repository,
   set **Root directory** `nike-deal-tracker/backend` and **Runtime** Docker. Alternatively, use `render.yaml`.
2. Environment variables:

| Variable | Value |
|---|---|
| `ENVIRONMENT` | `production` |
| `DATABASE_URL` | from step 1 |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | your login (only used if no user exists yet) |
| `CORS_ORIGINS`, `PUBLIC_APP_URL` | your Vercel URL, e.g. `https://nike-deals.vercel.app` |
| `EMAIL_PROVIDER`, `RESEND_API_KEY` or `SMTP_*`, `EMAIL_FROM`, `REPORT_RECIPIENT` | see section 5 |
| `SCAN_EXECUTOR` | `github` (recommended on sleeping free hosts; see section 6) |
| `GITHUB_REPOSITORY`, `GITHUB_TOKEN`, `GITHUB_REF` | for the *Run scan now* button (section 6) |

3. Check `https://<api>.onrender.com/health`, which should return `{"status":"ok"}`.

## 3. Dashboard on Vercel

1. In Vercel, choose **Add New → Project**, import the repository and set **Root directory** `nike-deal-tracker/frontend`.
2. Environment variables: `BACKEND_URL=https://<api>.onrender.com`, `COOKIE_SECURE=true`.
3. Deploy, open the URL and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Change the password
   under **Settings → Account**.

The browser only talks to Vercel. Vercel forwards `/api/backend/*` to the API with the session
token from an httpOnly cookie, so the token is never exposed to page scripts.

## 4. GitHub Actions: the weekly scan

The workflow file is `.github/workflows/nike-weekly-scan.yml` at the repository root.
GitHub **only runs scheduled workflows from the default branch**, so merge this branch into `main` first.

Add these in **Repository → Settings → Secrets and variables → Actions**:

| Kind | Name | Value |
|---|---|---|
| Secret | `DATABASE_URL` | from step 1 |
| Secret | `RESEND_API_KEY` | if using Resend |
| Secret | `SMTP_USERNAME`, `SMTP_PASSWORD` | if using SMTP |
| Secret | `FEED_URL_NL` … `FEED_URL_PL` | only if you use the feed connector |
| Variable | `EMAIL_PROVIDER` | `resend` or `smtp` |
| Variable | `EMAIL_FROM` | e.g. `Nike Deal Tracker <deals@yourdomain.com>` |
| Variable | `REPORT_RECIPIENT` | your email (the Settings page can override it) |
| Variable | `PUBLIC_APP_URL` | dashboard URL (for links in the email) |
| Variable | `SMTP_HOST`, `SMTP_PORT` | if using SMTP |
| Variable | `CONNECTOR_XX` | optional, e.g. `CONNECTOR_PL=feed` |

**Test it now:** go to **Actions → Nike weekly scan → Run workflow** and choose `scan-and-report`.
A full five-country scan takes about 60 minutes (about 170 requests per country with ≥ 4 s between
requests). Watch the log, then check the dashboard (**Settings → Scans**) and your inbox.

> **First real-world check.** This tracker was tested from a cloud data-centre IP, and Zalando
> accepted the honest User-Agent. GitHub's runners are also data-centre IPs, so check the
> per-country status after the first run. If a country shows **blocked**, the connector
> stopped as designed. Options:
> * switch that country to the authorised **feed** connector (`CONNECTOR_XX=feed` + `FEED_URL_XX`), or
> * run the workflow on your own always-on device with a [self-hosted runner](https://docs.github.com/actions/hosting-your-own-runners)
>   (Raspberry Pi/NAS; change `runs-on: ubuntu-latest` to `runs-on: self-hosted`), or use Docker (section 7).

## 5. Email

### Resend (recommended)
1. Sign up at resend.com, open **Domains → Add domain** and add the DNS records it shows (SPF/DKIM).
   For a quick test without a domain you can use `EMAIL_FROM=onboarding@resend.dev`; Resend then
   only delivers to your own account address.
2. Go to **API Keys → Create** (permission: *Sending access*), and set `RESEND_API_KEY`.
3. Set `EMAIL_PROVIDER=resend`, `EMAIL_FROM=Nike Deal Tracker <deals@your-domain>`.

### SMTP (Gmail, Outlook, Fastmail, Mailgun, …)
`EMAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT=587` (STARTTLS), `SMTP_USERNAME` and `SMTP_PASSWORD`.
For port 465 set `SMTP_USE_SSL=true`. Gmail needs 2-step verification and an
**App password** (Google Account → Security → App passwords); use `smtp.gmail.com`.

### Test
* Dashboard: **Settings → Send test report** (the API needs the email variables).
* GitHub: **Run workflow** with mode `report`.
* CLI: `python -m app.cli report --send --to you@example.com`.

Every attempt is logged in **Settings → Email delivery log**. Failed sends are retried 3× with
backoff. A scan that is `failed` or `partial` sends a separate failure notice (you can turn this off in Settings).

## 6. "Run scan now"

* `SCAN_EXECUTOR=github` (recommended with a sleeping free API host): the button triggers the
  workflow through `workflow_dispatch`. Create a **fine-grained personal access token** for this
  repository only, with **Actions: Read and write**, and set it as `GITHUB_TOKEN` on the API.
* `SCAN_EXECUTOR=local`: the scan runs inside the API process. Use this only on an always-on
  host (Docker/VPS), because a sleeping free instance can be stopped mid-scan.

## 7. Alternative: one always-on machine (Docker)

```bash
cd nike-deal-tracker
cp .env.example .env      # fill in POSTGRES_PASSWORD, ADMIN_*, JWT_SECRET, email settings
docker compose up -d --build
```

This starts PostgreSQL, a nightly `pg_dump` into `./backups`, the API with the built-in
scheduler (`RUN_INPROCESS_SCHEDULER=true`, so no GitHub Actions are needed) and the dashboard on
port 3000. Put it behind HTTPS (e.g. Caddy or a Cloudflare Tunnel) and set `COOKIE_SECURE=true`.

## 8. Activating the Monday 08:00 email — checklist

1. ☐ `main` contains `.github/workflows/nike-weekly-scan.yml`.
2. ☐ Actions secrets and variables from section 4 are set (`DATABASE_URL` and the email settings).
3. ☐ A manual **Run workflow → scan-and-report** succeeded and the email arrived.
4. ☐ In the dashboard, **Settings → Weekly scan & email report** shows Monday 08:00
   Europe/Amsterdam, your recipient, and "Send the weekly email report" ticked.

How it fires: GitHub wakes the workflow every hour between 04:07 and 10:07 UTC on Mondays.
`python -m app.cli tick` checks the schedule stored in the database. That is 08:00 Amsterdam,
which is 07:00 UTC in winter and 06:00 UTC in summer. The tick runs the weekly job once per
ISO week (and catches up for up to 8 hours if GitHub starts late). The other hourly wake-ups
exit within seconds. If you choose a day other than Monday in Settings, change the last cron
field in the workflow from `1` to `*`.

## 9. Monitoring and operations

* **Scan log:** Settings → Scans (per country: requests, products, new deals, rejected records, errors).
* **Health:** `GET /health` (liveness) and `GET /health/ready` (database plus warnings when the
  last scheduled scan is older than 8 days or the last weekly email didn't send). Point a free
  uptime monitor (e.g. UptimeRobot) at `/health/ready`.
* **Failures:** GitHub emails the repository owner when a workflow run fails. The tracker also
  sends its own failure notice.
* **Backups:** use your database provider's backups (Supabase/Neon), or `docker compose`'s
  nightly dump. Price history is append-only and is never rewritten by scans.
* **Keep-alive:** GitHub disables scheduled workflows in *public* repositories after 60 days
  without commits. Re-enable it under Actions if that happens.
* **Costs:** a full scan is about 60 Actions minutes per week, plus about 1 minute per hourly
  tick. That's roughly 300 minutes a month, within the 2,000 free minutes for private repos
  (unlimited for public ones).

## 10. Credentials you need to provide

| Credential | Needed for | Where it goes |
|---|---|---|
| PostgreSQL connection string | everything | `DATABASE_URL` (Render + GitHub secret) |
| Admin email + password | dashboard login | `ADMIN_EMAIL` / `ADMIN_PASSWORD` on the API (first start) |
| `JWT_SECRET` | session tokens | API |
| Resend API key **or** SMTP login | Monday email | API + GitHub secrets |
| Fine-grained GitHub token (Actions R/W) | "Run scan now" via Actions | API `GITHUB_TOKEN` (optional) |
| Affiliate feed URLs (Awin publisher account, Zalando programme) | `feed` connector | `FEED_URL_XX` (optional) |
