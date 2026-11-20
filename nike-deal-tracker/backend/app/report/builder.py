"""Weekly report: data selection + rendering (HTML email and plain text)."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..analytics import DealFilters, country_summary, load_rows, real_data_exists, sort_rows
from ..catalog.franchises import FRANCHISES
from ..config import get_settings
from ..emailer import deliver, recipient_for
from ..models import DealEvent, EmailReport, ScanSession, User
from ..scheduler import schedule_settings
from ..watchlist import evaluate

TEMPLATES = Path(__file__).parent / "templates"
_env = Environment(loader=FileSystemLoader(TEMPLATES), autoescape=select_autoescape(["html"]))
COUNTRY_NAMES = {"NL": "Netherlands", "DE": "Germany", "FR": "France", "ES": "Spain", "PL": "Poland"}
FLAGS = {"NL": "🇳🇱", "DE": "🇩🇪", "FR": "🇫🇷", "ES": "🇪🇸", "PL": "🇵🇱"}


def _money(v: float | None, cur: str = "EUR") -> str:
    if v is None:
        return "–"
    if cur == "PLN":
        return f"{v:,.2f} zł".replace(",", " ").replace(".", ",")
    return f"€{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


_env.filters["money"] = _money
_env.globals["FLAGS"] = FLAGS
_env.globals["COUNTRY_NAMES"] = COUNTRY_NAMES


def best_per_product(rows: list[dict], key: str = "score") -> list[dict]:
    """One entry per SKU: the best country by ``key``; the other countries are listed in ``also_in``."""
    by: dict[int, list[dict]] = {}
    for r in rows:
        by.setdefault(r["product_id"], []).append(r)
    out = []
    for rs in by.values():
        rs = sort_rows(rs, key)
        best = dict(rs[0])
        best["also_in"] = [{"country": o["country"], "price_eur": o["price_eur"], "discount_pct": o["discount_pct"]} for o in rs[1:]]
        out.append(best)
    return sort_rows(out, key)


def build_context(db: Session, scan: ScanSession | None = None, *, now: datetime | None = None) -> dict:
    st = schedule_settings(db)
    tz = st.timezone if st else "Europe/Amsterdam"
    now = now or datetime.now(timezone.utc)
    min_disc = st.report_min_discount if st else 20
    include_sample = not real_data_exists(db)
    all_rows = load_rows(db, DealFilters(in_stock_only=False), include_sample=include_sample)
    rows = [r for r in all_rows if r["in_stock"]]
    disc = [r for r in rows if r["discount_pct"] >= 10]

    user = db.scalar(select(User).order_by(User.id).limit(1))
    wl = evaluate(db, user.id, all_rows) if user else {"matches": [], "watched_variant_ids": set(), "rules": []}
    watched = wl["watched_variant_ids"]
    for r in all_rows:
        r["watched"] = r["variant_id"] in watched

    top = best_per_product([r for r in disc if r["discount_pct"] >= min_disc], "score")[:20]
    af1 = best_per_product([r for r in disc if r["franchise"] and r["franchise"]["slug"] == "air-force-1"], "discount")[:15]
    priority = []
    for f in FRANCHISES:
        if f.priority != 1 or f.slug == "air-force-1":
            continue
        deals = best_per_product([r for r in disc if r["franchise"] and r["franchise"]["slug"] == f.slug], "discount")[:3]
        priority.append({"slug": f.slug, "name": f.name, "deals": deals})

    drops = []
    baseline = True
    if scan is not None:
        prev_ok = db.scalar(select(ScanSession.id).where(ScanSession.id < scan.id, ScanSession.status.in_(("success", "partial"))).limit(1))
        baseline = prev_ok is None
        ev = {e.variant_id: e for e in db.scalars(select(DealEvent).where(DealEvent.scan_id == scan.id, DealEvent.kind == "price_drop"))}
        by_vid = {r["variant_id"]: r for r in rows}
        for vid, e in ev.items():
            if vid in by_vid and e.old_value is not None and e.new_value is not None:
                r = by_vid[vid]
                drops.append({**r, "drop_from_eur": float(e.old_value), "drop_eur": round(float(e.old_value) - float(e.new_value), 2)})
        drops.sort(key=lambda d: d["drop_eur"], reverse=True)
        new_deals = len({e.variant_id for e in db.scalars(select(DealEvent).where(DealEvent.scan_id == scan.id, DealEvent.kind == "new_discount"))})
    else:
        new_deals = 0

    best = max(disc, key=lambda r: (r["discount_pct"], r["discount_amount_eur"]), default=None)
    countries = country_summary(rows)
    local_date = now.astimezone(ZoneInfo(tz))
    sample = include_sample and bool(all_rows)
    subject = f"NIKE DEAL TRACKER – Weekly Zalando Deals – {local_date:%d %b %Y}"
    if sample:
        subject = "[SAMPLE DATA] " + subject
    scan_results = []
    if scan is not None:
        scan_results = [{"country": r.country_code, "status": r.status, "connector": r.connector, "updated": r.products_updated,
                         "error": (r.errors or [None])[0]} for r in scan.results]
    return {
        "subject": subject, "date": f"{local_date:%A %d %B %Y}", "sample": sample, "baseline": baseline,
        "app_url": get_settings().public_app_url.rstrip("/"), "min_discount": min_disc,
        "overview": {
            "monitored": len({r["product_id"] for r in all_rows}), "listings": len(all_rows),
            "discounted": len({r["product_id"] for r in disc}), "new_deals": new_deals,
            "strong": len({r["product_id"] for r in disc if r["discount_pct"] >= 30}), "best": best,
        },
        "top": top, "af1": af1, "priority": priority, "countries": countries, "best_country": countries[0] if countries else None,
        "drops": drops[:20], "watch": wl["matches"][:25], "watch_rules": wl["rules"], "scan": scan, "scan_results": scan_results,
        "significant": bool(top),
    }


def render(ctx: dict) -> tuple[str, str]:
    html = _env.get_template("weekly.html").render(**ctx)
    text = _env.get_template("weekly.txt").render(**ctx)
    return html, text


def send_weekly_report(db: Session, scan: ScanSession | None, *, to: str | None = None, kind: str = "weekly") -> EmailReport:
    ctx = build_context(db, scan)
    html, text = render(ctx)
    to = to or recipient_for(db)
    if not to:
        rep = EmailReport(scan_id=scan.id if scan else None, kind=kind, recipient="-", subject=ctx["subject"], status="skipped",
                          provider=get_settings().email_provider, error="no recipient configured", html=html)
        db.add(rep)
        db.commit()
        return rep
    return deliver(db, to=to, subject=ctx["subject"], html=html, text=text, kind=kind, scan=scan)
