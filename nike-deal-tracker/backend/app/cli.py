"""Command line entry points (used by GitHub Actions, cron and humans).

    python -m app.cli init                 # create tables, seed countries/franchises/admin
    python -m app.cli tick                 # scheduler heartbeat: runs the weekly job when due
    python -m app.cli weekly               # force: scan all countries + email report
    python -m app.cli scan [--country NL] [--connector feed]
    python -m app.cli report [--send] [--out report.html]
    python -m app.cli probe --country NL   # check robots.txt / reachability, 1–2 requests
    python -m app.cli fx                   # refresh ECB exchange rates
    python -m app.cli seed-sample          # load clearly labelled SAMPLE data (UI testing)
    python -m app.cli purge-sample
    python -m app.cli create-user EMAIL
"""
from __future__ import annotations

import argparse
import getpass
import json
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

from .config import get_settings
from .db import SessionLocal, init_db
from .logging_setup import setup_logging


def _db():
    init_db()
    return SessionLocal()


def cmd_init(_):
    from .seed import bootstrap

    db = _db()
    bootstrap(db)
    print("database ready")


def cmd_tick(args):
    from .scheduler import tick
    from .seed import bootstrap

    db = _db()
    bootstrap(db)
    res = tick(db)
    print(json.dumps(res, default=str))
    if args.github_output:
        with open(args.github_output, "a") as fh:
            fh.write(f"ran={'true' if res.get('ran') else 'false'}\n")
    return 0 if not res.get("ran") or res.get("scan_status") in ("success", "partial") else 1


def cmd_weekly(args):
    from .scanner import week_key_for
    from .scheduler import run_weekly_job
    from .seed import bootstrap

    db = _db()
    bootstrap(db)
    trigger = "schedule" if args.as_scheduled else "manual"
    key = week_key_for(datetime.now(timezone.utc)) if args.as_scheduled else None
    res = run_weekly_job(db, trigger=trigger, week_key=key, send_email=not args.no_email)
    print(json.dumps(res, default=str))
    return 0 if res["scan_status"] in ("success", "partial") else 1


def cmd_scan(args):
    from .scanner import run_scan
    from .seed import bootstrap

    db = _db()
    bootstrap(db)
    countries = [c.upper() for c in args.country] if args.country else None
    scan = run_scan(db, trigger="cli", countries=countries, connector_override=args.connector)
    for r in scan.results:
        print(f"{r.country_code} [{r.connector}] {r.status}: found={r.products_found} updated={r.products_updated} "
              f"new={r.new_products} new_discounts={r.new_discounts} rejected={r.rejected_records} requests={r.requests_made}")
        for e in (r.errors or [])[:5]:
            print(f"    ! {str(e)[:300]}")
    print(f"scan #{scan.id}: {scan.status}")
    return 0 if scan.status in ("success", "partial") else 1


def cmd_report(args):
    from .models import ScanSession
    from .report.builder import build_context, render, send_weekly_report

    db = _db()
    last = db.scalar(select(ScanSession).where(ScanSession.status.in_(("success", "partial"))).order_by(ScanSession.started_at.desc()).limit(1))
    if args.send:
        rep = send_weekly_report(db, last, to=args.to, kind="test" if args.to else "weekly")
        print(f"report {rep.id}: {rep.status} {rep.error or ''}")
        return 0 if rep.status == "sent" else 1
    ctx = build_context(db, last)
    html, text = render(ctx)
    if args.out:
        open(args.out, "w").write(html)
        print(f"wrote {args.out}")
    else:
        print(text)
    return 0


def cmd_probe(args):
    """Minimal reachability check: robots.txt + first catalogue page (2 requests max)."""
    from .connectors.base import AccessBlocked, ConnectorError, CountryConfig
    from .connectors.registry import COUNTRY_SEED, make_client
    from .connectors.zalando_web import parse_embedded_products, parse_json_ld_products, parse_product_links

    s = get_settings()
    rc = 0
    for code, _name, domain, cur, lang, path in COUNTRY_SEED:
        if args.country and code not in [c.upper() for c in args.country]:
            continue
        cfg = CountryConfig(code, domain, cur, lang, path)
        client = make_client(s, lang)
        client.cache_dir = None
        url = cfg.base_url + path
        try:
            allowed = client.allowed(url)
            if not allowed:
                print(f"{code}: robots.txt DISALLOWS {url}")
                rc = 1
                continue
            html = client.get_text(url, use_cache=False)
            cards = parse_embedded_products(html, cfg, cfg.base_url) or parse_json_ld_products(html, cfg, cfg.base_url)
            links = parse_product_links(html, cfg.base_url)
            print(f"{code}: OK — {len(cards)} priced products, {len(links)} product links on page 1")
            for c in cards[:3]:
                print(f"    {c.sku} {c.name[:60]} {c.price} {c.currency} (orig {c.original_price})")
        except AccessBlocked as e:
            print(f"{code}: BLOCKED — {e}")
            rc = 1
        except ConnectorError as e:
            print(f"{code}: ERROR — {e}")
            rc = 1
        finally:
            client.close()
    return rc


def cmd_fx(_):
    from .fx import refresh_rates

    db = _db()
    rates = refresh_rates(db)
    db.commit()
    for r in rates:
        print(f"{r.rate_date} 1 EUR = {r.rate} {r.quote} ({r.source})")


def cmd_seed_sample(args):
    """Fictional, clearly labelled data for UI testing; builds a few weeks of sample history."""
    from decimal import Decimal

    from .connectors.sample import PLN_PER_EUR, SampleConnector
    from .fx import FxConverter
    from .scanner import Scanner
    from .seed import bootstrap

    db = _db()
    bootstrap(db)
    weeks = args.weeks
    start = datetime.now(timezone.utc) - timedelta(weeks=weeks - 1)
    fx = FxConverter({"PLN": Decimal(str(PLN_PER_EUR))})
    for w in range(weeks):
        sc = Scanner(db, connector_factory=lambda n, c, st, w=w: SampleConnector(week=w), fx=fx, now=start + timedelta(weeks=w))
        scan = sc.run(trigger="cli", connector_override="sample")
        print(f"sample week {w + 1}/{weeks}: scan #{scan.id} {scan.status} ({scan.products_updated} listings)")
    print("SAMPLE DATA loaded. It is flagged as sample everywhere. Remove with: python -m app.cli purge-sample")


def cmd_purge_sample(_):
    from .models import Product, ScanSession

    db = _db()
    n = db.execute(delete(Product).where(Product.is_sample.is_(True))).rowcount
    m = db.execute(delete(ScanSession).where(ScanSession.is_sample.is_(True))).rowcount
    db.commit()
    print(f"removed {n} sample products and {m} sample scans")


def cmd_create_user(args):
    from .seed import create_user

    db = _db()
    pw = args.password or getpass.getpass("password (min 10 chars): ")
    if len(pw) < 10:
        print("password too short")
        return 1
    create_user(db, args.email, pw, is_admin=True)
    db.commit()
    print("user created")


def main(argv: list[str] | None = None) -> int:
    s = get_settings()
    setup_logging(s.log_level, s.log_json)
    p = argparse.ArgumentParser(prog="nike-deal-tracker")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init").set_defaults(fn=cmd_init)
    t = sub.add_parser("tick")
    t.add_argument("--github-output", default=None)
    t.set_defaults(fn=cmd_tick)
    w = sub.add_parser("weekly")
    w.add_argument("--no-email", action="store_true")
    w.add_argument("--as-scheduled", action="store_true", help="count as this week's scheduled run")
    w.set_defaults(fn=cmd_weekly)
    sc = sub.add_parser("scan")
    sc.add_argument("--country", action="append")
    sc.add_argument("--connector", choices=["zalando_web", "feed", "sample"])
    sc.set_defaults(fn=cmd_scan)
    r = sub.add_parser("report")
    r.add_argument("--send", action="store_true")
    r.add_argument("--to")
    r.add_argument("--out")
    r.set_defaults(fn=cmd_report)
    pr = sub.add_parser("probe")
    pr.add_argument("--country", action="append")
    pr.set_defaults(fn=cmd_probe)
    sub.add_parser("fx").set_defaults(fn=cmd_fx)
    ss = sub.add_parser("seed-sample")
    ss.add_argument("--weeks", type=int, default=6)
    ss.set_defaults(fn=cmd_seed_sample)
    sub.add_parser("purge-sample").set_defaults(fn=cmd_purge_sample)
    cu = sub.add_parser("create-user")
    cu.add_argument("email")
    cu.add_argument("--password")
    cu.set_defaults(fn=cmd_create_user)
    args = p.parse_args(argv)
    return args.fn(args) or 0


if __name__ == "__main__":
    sys.exit(main())
