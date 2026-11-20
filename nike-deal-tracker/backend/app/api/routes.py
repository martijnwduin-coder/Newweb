from __future__ import annotations

import logging
import threading
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import desc, func, select, text
from sqlalchemy.orm import Session

from .. import analytics
from ..analytics import DealFilters
from ..auth import client_ip, create_token, current_user, hash_password, login_limiter, require_cron_token, verify_password
from ..catalog.franchises import GROUPS
from ..config import get_settings
from ..connectors.registry import AVAILABLE_CONNECTORS
from ..db import SessionLocal, get_db
from ..models import (
    Country,
    EmailReport,
    ExchangeRate,
    Franchise,
    Product,
    ProductAvailability,
    ProductVariant,
    ScanSession,
    User,
    UserSettings,
    Watchlist,
    WatchlistRule,
)
from ..scanner import ScanAlreadyRunning, Scanner, running_scan
from ..scheduler import is_due, next_run, schedule_settings

log = logging.getLogger(__name__)
public = APIRouter()
api = APIRouter(prefix="/api", dependencies=[Depends(current_user)])
internal = APIRouter(prefix="/internal", dependencies=[Depends(require_cron_token)])


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).isoformat()


# ============================================================================ health
@public.get("/health")
def health() -> dict:
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}


@public.get("/health/ready")
def ready(db: Session = Depends(get_db)) -> dict:
    db.execute(text("SELECT 1"))
    last_sched = db.scalar(select(ScanSession).where(ScanSession.trigger == "schedule").order_by(desc(ScanSession.started_at)).limit(1))
    warnings = []
    if last_sched is None:
        warnings.append("no scheduled scan has run yet")
    elif datetime.now(timezone.utc) - (last_sched.started_at if last_sched.started_at.tzinfo else last_sched.started_at.replace(tzinfo=timezone.utc)) > timedelta(days=8):
        warnings.append("last scheduled scan is older than 8 days: check the scheduler")
    last_mail = db.scalar(select(EmailReport).where(EmailReport.kind == "weekly").order_by(desc(EmailReport.created_at)).limit(1))
    if last_mail is not None and last_mail.status != "sent":
        warnings.append(f"last weekly email status: {last_mail.status}")
    return {"status": "ok", "database": "ok", "warnings": warnings,
            "last_scheduled_scan": analytics.scan_brief(last_sched), "last_weekly_email": last_mail.status if last_mail else None}


# ============================================================================ auth
class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


@public.post("/auth/login")
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)) -> dict:
    ip = client_ip(request)
    if login_limiter.limited(ip):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "too many failed login attempts, try again in a few minutes")
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        login_limiter.hit(ip)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid email or password")
    return {"token": create_token(user), "user": {"id": user.id, "email": user.email}}


@public.get("/auth/me")
def me(user: User = Depends(current_user)) -> dict:
    return {"id": user.id, "email": user.email, "is_admin": user.is_admin}


class PasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=10, max_length=200)


@api.post("/auth/change-password")
def change_password(body: PasswordIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    u = db.get(User, user.id)
    if not verify_password(body.current_password, u.password_hash):
        raise HTTPException(400, "current password is wrong")
    u.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True}


# ============================================================================ deals & products
@api.get("/overview")
def overview(db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    data = analytics.overview(db)
    st = schedule_settings(db)
    data["next_scheduled_scan"] = _iso(next_run(datetime.now(timezone.utc), st.schedule_weekday, st.schedule_hour, st.schedule_minute, st.timezone)) if st else None
    from ..watchlist import evaluate

    wl = evaluate(db, user.id)
    data["watchlist_alerts"] = len(wl["matches"])
    data["watchlist_matches"] = wl["matches"][:6]
    running = running_scan(db)
    data["running_scan"] = analytics.scan_brief(running)
    return data


def _csv(v: str | None) -> list[str]:
    return [x.strip() for x in v.split(",") if x.strip()] if v else []


@api.get("/deals")
def deals(
    db: Session = Depends(get_db), user: User = Depends(current_user),
    min_discount: float | None = Query(None, ge=0, le=100), max_discount: float | None = Query(None, ge=0, le=100),
    max_price: float | None = Query(None, ge=0), country: str | None = None, franchise: str | None = None,
    group: str | None = None, category: str | None = None, gender: str | None = None, size: str | None = Query(None, max_length=16),
    q: str | None = Query(None, max_length=100), sort: str = "discount", in_stock: bool = True, discounted: bool = True,
    new_days: int | None = Query(None, ge=1, le=90), page: int = Query(1, ge=1), page_size: int = Query(48, ge=1, le=200),
) -> dict:
    if group and group not in GROUPS:
        raise HTTPException(400, "unknown group")
    flt = DealFilters(
        min_discount=min_discount, max_discount=max_discount, max_price_eur=max_price, countries=_csv(country),
        franchises=_csv(franchise), group=group, categories=_csv(category), genders=_csv(gender), size=size, q=q,
        in_stock_only=in_stock, discounted_only=discounted,
        new_since=datetime.now(timezone.utc) - timedelta(days=new_days) if new_days else None,
    )
    rows = analytics.sort_rows(analytics.load_rows(db, flt), sort)
    from ..watchlist import evaluate

    watched = evaluate(db, user.id, rows)["watched_variant_ids"]
    for r in rows:
        r["watched"] = r["variant_id"] in watched
    total = len(rows)
    start = (page - 1) * page_size
    return {"total": total, "page": page, "page_size": page_size, "items": rows[start:start + page_size],
            "sample_mode": analytics.sample_mode(db)}


@api.get("/filters")
def filters(db: Session = Depends(get_db)) -> dict:
    include_sample = not analytics.real_data_exists(db)
    rows = analytics.load_rows(db, DealFilters(in_stock_only=False), include_sample=include_sample)
    sizes: set[str] = set()
    for r in rows:
        sizes.update(str(s) for s in r["sizes"])

    def size_key(s: str):
        try:
            return (0, float(s.replace(",", ".")), s)
        except ValueError:
            order = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL"]
            return (1, order.index(s) if s in order else 99, s)

    fr_counts: dict[str, int] = {}
    for r in rows:
        if r["franchise"]:
            fr_counts[r["franchise"]["slug"]] = fr_counts.get(r["franchise"]["slug"], 0) + 1
    franchises = [{"slug": f.slug, "name": f.name, "group": f.group, "priority": f.priority, "count": fr_counts.get(f.slug, 0)}
                  for f in db.scalars(select(Franchise).where(Franchise.active.is_(True)).order_by(Franchise.priority, Franchise.name))]
    return {
        "countries": [{"code": c.code, "name": c.name, "currency": c.currency} for c in db.scalars(select(Country).order_by(Country.code))],
        "franchises": franchises, "groups": [{"slug": k, "name": v} for k, v in GROUPS.items()],
        "categories": sorted({r["category"] for r in rows}), "genders": ["men", "women", "kids", "unisex"],
        "sizes": sorted(sizes, key=size_key),
    }


@api.get("/products")
def search_products(db: Session = Depends(get_db), q: str | None = Query(None, max_length=100), franchise: str | None = None,
                    limit: int = Query(30, ge=1, le=100)) -> list[dict]:
    include_sample = not analytics.real_data_exists(db)
    stmt = select(Product).order_by(Product.name)
    if not include_sample:
        stmt = stmt.where(Product.is_sample.is_(False))
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(func.lower(Product.name).like(like) | func.lower(func.coalesce(Product.sku, "")).like(like) | func.lower(func.coalesce(Product.colourway, "")).like(like))
    if franchise:
        stmt = stmt.join(Franchise, Franchise.id == Product.franchise_id).where(Franchise.slug == franchise)
    return [{"id": p.id, "sku": p.sku, "name": p.name, "model": p.model, "colourway": p.colourway, "image_url": p.image_url,
             "franchise": p.franchise.name if p.franchise else None, "is_sample": p.is_sample} for p in db.scalars(stmt.limit(limit))]


@api.get("/products/{product_id}")
def product_detail(product_id: int, db: Session = Depends(get_db)) -> dict:
    cmp = analytics.compare_product(db, product_id)
    if cmp is None:
        raise HTTPException(404, "product not found")
    p = db.get(Product, product_id)
    hist = analytics.history_for_product(db, product_id)
    sizes = {}
    for v in p.variants:
        sizes[v.country_code] = [{"size": a.size, "in_stock": a.in_stock} for a in db.scalars(select(ProductAvailability).where(ProductAvailability.variant_id == v.id))]
    return {**cmp, "model": p.model, "category": p.category, "subcategory": p.subcategory, "gender": p.gender,
            "franchise": {"slug": p.franchise.slug, "name": p.franchise.name} if p.franchise else None,
            "first_seen_at": _iso(p.first_seen_at), "history_stats": hist["stats"], "size_availability": sizes}


@api.get("/products/{product_id}/history")
def product_history(product_id: int, db: Session = Depends(get_db), country: str | None = Query(None, max_length=2),
                    days: int | None = Query(None, ge=1, le=3650)) -> dict:
    if db.get(Product, product_id) is None:
        raise HTTPException(404, "product not found")
    return analytics.history_for_product(db, product_id, country=country, days=days)


@api.get("/compare")
def compare(db: Session = Depends(get_db), group: str | None = None, franchise: str | None = None,
            q: str | None = Query(None, max_length=100), limit: int = Query(100, ge=1, le=500)) -> dict:
    items = analytics.compare_list(db, group=group, franchise=franchise, q=q, limit=limit)
    return {"items": items, "total": len(items)}


# ============================================================================ franchises & countries
class FranchiseIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    slug: str = Field(pattern=r"^[a-z0-9-]{2,60}$")
    group: Literal["air-force-1", "air-max", "running", "basketball", "training", "other"]
    priority: int = Field(2, ge=1, le=3)
    patterns: list[str] = Field(min_length=1, max_length=10)
    specificity: int = Field(100, ge=0, le=1000)

    @field_validator("patterns")
    @classmethod
    def _valid_regex(cls, v: list[str]) -> list[str]:
        import re

        for p in v:
            if len(p) > 120:
                raise ValueError("pattern too long")
            try:
                re.compile(p)
            except re.error as e:
                raise ValueError(f"invalid regular expression {p!r}: {e}")
        return v


@api.get("/franchises")
def list_franchises(db: Session = Depends(get_db)) -> list[dict]:
    return [{"id": f.id, "slug": f.slug, "name": f.name, "group": f.group, "priority": f.priority, "patterns": f.patterns,
             "specificity": f.specificity, "active": f.active, "is_custom": f.is_custom}
            for f in db.scalars(select(Franchise).order_by(Franchise.priority, Franchise.name))]


@api.post("/franchises", status_code=201)
def create_franchise(body: FranchiseIn, db: Session = Depends(get_db)) -> dict:
    if db.scalar(select(Franchise).where(Franchise.slug == body.slug)):
        raise HTTPException(409, "slug already exists")
    f = Franchise(**body.model_dump(), active=True, is_custom=True)
    db.add(f)
    db.commit()
    return {"id": f.id}


class FranchisePatch(BaseModel):
    active: bool | None = None
    priority: int | None = Field(None, ge=1, le=3)


@api.patch("/franchises/{fid}")
def patch_franchise(fid: int, body: FranchisePatch, db: Session = Depends(get_db)) -> dict:
    f = db.get(Franchise, fid)
    if not f:
        raise HTTPException(404)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(f, k, v)
    db.commit()
    return {"ok": True}


@api.post("/franchises/reclassify")
def reclassify(db: Session = Depends(get_db)) -> dict:
    """Re-run franchise matching on stored products (after adding a franchise)."""
    from ..catalog.classifier import classify
    from ..scanner import franchise_pool

    pool, by_slug = franchise_pool(db)
    changed = 0
    for p in db.scalars(select(Product)):
        c = classify(p.name, colour=p.colourway, pool=pool)
        fid = by_slug[c.franchise_slug].id if c.franchise_slug in by_slug else None
        if p.category == "footwear" and fid != p.franchise_id:
            p.franchise_id = fid
            changed += 1
    db.commit()
    return {"changed": changed}


@api.get("/countries")
def list_countries(db: Session = Depends(get_db)) -> list[dict]:
    s = get_settings()
    return [{"code": c.code, "name": c.name, "domain": c.domain, "currency": c.currency, "enabled": c.enabled,
             "connector": c.connector or s.connector_for(c.code), "connector_override": c.connector, "nike_path": c.nike_path,
             "feed_configured": bool(s.feed_url_for(c.code)), "shipping_note": c.shipping_note}
            for c in db.scalars(select(Country).order_by(Country.code))]


class CountryPatch(BaseModel):
    enabled: bool | None = None
    connector: Literal["zalando_web", "feed", "sample", "disabled", ""] | None = None
    nike_path: str | None = Field(None, pattern=r"^/[a-z0-9\-/_]*$", max_length=120)


@api.patch("/countries/{code}")
def patch_country(code: str, body: CountryPatch, db: Session = Depends(get_db)) -> dict:
    c = db.get(Country, code.upper())
    if not c:
        raise HTTPException(404)
    data = body.model_dump(exclude_none=True)
    if "connector" in data:
        data["connector"] = data["connector"] or None
    for k, v in data.items():
        setattr(c, k, v)
    db.commit()
    return {"ok": True}


# ============================================================================ watchlist
def _watchlist(db: Session, user: User) -> Watchlist:
    wl = db.scalar(select(Watchlist).where(Watchlist.user_id == user.id).order_by(Watchlist.id).limit(1))
    if wl is None:
        wl = Watchlist(user_id=user.id)
        db.add(wl)
        db.commit()
    return wl


class RuleIn(BaseModel):
    kind: Literal["product", "franchise", "colourway"]
    label: str | None = Field(None, max_length=200)
    product_id: int | None = None
    franchise_slug: str | None = Field(None, max_length=64)
    colourway: str | None = Field(None, max_length=200)
    size: str | None = Field(None, max_length=16)
    country_code: Literal["NL", "DE", "FR", "ES", "PL"] | None = None
    min_discount: int | None = Field(None, ge=1, le=95)
    max_price_eur: float | None = Field(None, gt=0, le=5000)
    active: bool = True


def _rule_out(r: WatchlistRule, db: Session) -> dict:
    f = db.get(Franchise, r.franchise_id) if r.franchise_id else None
    p = db.get(Product, r.product_id) if r.product_id else None
    return {"id": r.id, "kind": r.kind, "label": r.label, "product_id": r.product_id, "product_name": p.name if p else None,
            "franchise_slug": f.slug if f else None, "franchise_name": f.name if f else None, "colourway": r.colourway,
            "size": r.size, "country_code": r.country_code, "min_discount": r.min_discount,
            "max_price_eur": float(r.max_price_eur) if r.max_price_eur is not None else None, "active": r.active}


def _apply_rule(rule: WatchlistRule, body: RuleIn, db: Session) -> None:
    rule.kind, rule.label, rule.colourway, rule.size = body.kind, body.label, body.colourway, body.size
    rule.country_code, rule.min_discount, rule.active = body.country_code, body.min_discount, body.active
    rule.max_price_eur = Decimal(str(body.max_price_eur)) if body.max_price_eur is not None else None
    rule.product_id = body.product_id if body.kind == "product" else None
    rule.franchise_id = None
    if body.franchise_slug:
        f = db.scalar(select(Franchise).where(Franchise.slug == body.franchise_slug))
        if not f:
            raise HTTPException(400, "unknown franchise")
        rule.franchise_id = f.id
    if body.kind == "product" and (not body.product_id or not db.get(Product, body.product_id)):
        raise HTTPException(400, "product_id required")
    if body.kind == "franchise" and rule.franchise_id is None:
        raise HTTPException(400, "franchise_slug required")
    if body.kind == "colourway" and not body.colourway:
        raise HTTPException(400, "colourway required")


@api.get("/watchlist")
def get_watchlist(db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    from ..watchlist import evaluate

    wl = _watchlist(db, user)
    ev = evaluate(db, user.id)
    stats = {r["id"]: r for r in ev["rules"]}
    rules = []
    for r in wl.rules:
        o = _rule_out(r, db)
        o.update({k: stats.get(r.id, {}).get(k, 0) for k in ("tracked", "triggered")})
        o["description"] = stats.get(r.id, {}).get("description")
        rules.append(o)
    return {"rules": rules, "matches": ev["matches"]}


@api.post("/watchlist/rules", status_code=201)
def add_rule(body: RuleIn, db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    wl = _watchlist(db, user)
    rule = WatchlistRule(watchlist_id=wl.id, kind=body.kind)
    _apply_rule(rule, body, db)
    db.add(rule)
    db.commit()
    return _rule_out(rule, db)


def _own_rule(rule_id: int, db: Session, user: User) -> WatchlistRule:
    rule = db.get(WatchlistRule, rule_id)
    if not rule or rule.watchlist.user_id != user.id:
        raise HTTPException(404)
    return rule


@api.put("/watchlist/rules/{rule_id}")
def update_rule(rule_id: int, body: RuleIn, db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    rule = _own_rule(rule_id, db, user)
    _apply_rule(rule, body, db)
    db.commit()
    return _rule_out(rule, db)


@api.delete("/watchlist/rules/{rule_id}", status_code=204)
def delete_rule(rule_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)) -> Response:
    db.delete(_own_rule(rule_id, db, user))
    db.commit()
    return Response(status_code=204)


# ============================================================================ settings
class SettingsIn(BaseModel):
    report_email: EmailStr | None = None
    report_enabled: bool | None = None
    schedule_weekday: int | None = Field(None, ge=0, le=6)
    schedule_hour: int | None = Field(None, ge=0, le=23)
    schedule_minute: int | None = Field(None, ge=0, le=59)
    timezone: str | None = Field(None, max_length=64)
    report_min_discount: int | None = Field(None, ge=0, le=90)
    flag_discount: int | None = Field(None, ge=1, le=90)
    notify_on_failure: bool | None = None
    theme: Literal["dark", "light"] | None = None

    @field_validator("timezone")
    @classmethod
    def _tz(cls, v: str | None) -> str | None:
        if v is None:
            return v
        from zoneinfo import ZoneInfo

        try:
            ZoneInfo(v)
        except Exception:
            raise ValueError("unknown time zone")
        return v


def _settings_row(db: Session, user: User) -> UserSettings:
    st = db.scalar(select(UserSettings).where(UserSettings.user_id == user.id))
    if st is None:
        st = UserSettings(user_id=user.id, report_email=user.email)
        db.add(st)
        db.commit()
    return st


@api.get("/settings")
def get_user_settings(db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    st = _settings_row(db, user)
    s = get_settings()
    now = datetime.now(timezone.utc)
    due, reason, _ = is_due(db, now)
    return {
        "report_email": st.report_email, "report_enabled": st.report_enabled, "schedule_weekday": st.schedule_weekday,
        "schedule_hour": st.schedule_hour, "schedule_minute": st.schedule_minute, "timezone": st.timezone,
        "report_min_discount": st.report_min_discount, "flag_discount": st.flag_discount,
        "notify_on_failure": st.notify_on_failure, "theme": st.theme,
        "next_run": _iso(next_run(now, st.schedule_weekday, st.schedule_hour, st.schedule_minute, st.timezone)),
        "scheduler_status": reason,
        "system": {
            "email_provider": s.email_provider,
            "email_configured": (s.email_provider == "resend" and bool(s.resend_api_key)) or (s.email_provider == "smtp" and bool(s.smtp_host)),
            "email_from": s.email_from, "scan_executor": s.scan_executor,
            "github_dispatch_configured": bool(s.github_repository and s.github_token),
            "inprocess_scheduler": s.run_inprocess_scheduler, "connectors": list(AVAILABLE_CONNECTORS),
            "http_min_delay_seconds": s.http_min_delay_seconds, "environment": s.environment,
        },
    }


@api.put("/settings")
def put_user_settings(body: SettingsIn, db: Session = Depends(get_db), user: User = Depends(current_user)) -> dict:
    st = _settings_row(db, user)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(st, k, v)
    db.commit()
    return get_user_settings(db, user)


# ============================================================================ scans
def _scan_out(s: ScanSession, detail: bool = False) -> dict:
    out = analytics.scan_brief(s) or {}
    out.update({"products_updated": s.products_updated, "new_products": s.new_products, "error": s.error, "week_key": s.week_key})
    out["countries"] = [{"country": r.country_code, "connector": r.connector, "status": r.status, "started_at": _iso(r.started_at),
                         "finished_at": _iso(r.finished_at), "requests": r.requests_made, "products_found": r.products_found,
                         "products_updated": r.products_updated, "new_products": r.new_products, "new_discounts": r.new_discounts,
                         "rejected": r.rejected_records, "errors": (r.errors or []) if detail else (r.errors or [])[:3]}
                        for r in s.results]
    return out


@api.get("/scans")
def list_scans(db: Session = Depends(get_db), limit: int = Query(20, ge=1, le=100)) -> list[dict]:
    return [_scan_out(s) for s in db.scalars(select(ScanSession).order_by(desc(ScanSession.started_at)).limit(limit))]


@api.get("/scans/{scan_id}")
def get_scan(scan_id: int, db: Session = Depends(get_db)) -> dict:
    s = db.get(ScanSession, scan_id)
    if not s:
        raise HTTPException(404)
    return _scan_out(s, detail=True)


class RunScanIn(BaseModel):
    countries: list[Literal["NL", "DE", "FR", "ES", "PL"]] | None = None
    send_report: bool = False


def _background_scan(scan_id: int, countries: list[str] | None, send_report: bool) -> None:
    db = SessionLocal()
    try:
        scan = db.get(ScanSession, scan_id)
        Scanner(db).run(scan=scan, countries=countries)
        if send_report and scan.status != "failed":
            from ..report.builder import send_weekly_report

            send_weekly_report(db, scan, kind="manual")
    except Exception:
        log.exception("background scan %s crashed", scan_id)
        s = db.get(ScanSession, scan_id)
        if s and s.status == "running":
            s.status, s.error, s.finished_at = "failed", "crashed (see logs)", datetime.now(timezone.utc)
            db.commit()
    finally:
        db.close()


@api.post("/scans/run", status_code=202)
def run_scan_now(body: RunScanIn, db: Session = Depends(get_db)) -> dict:
    s = get_settings()
    if running_scan(db):
        raise HTTPException(409, "a scan is already running")
    if s.scan_executor == "github":
        if not (s.github_repository and s.github_token):
            raise HTTPException(500, "GITHUB_REPOSITORY / GITHUB_TOKEN not configured")
        r = httpx.post(
            f"https://api.github.com/repos/{s.github_repository}/actions/workflows/{s.github_workflow_file}/dispatches",
            headers={"Authorization": f"Bearer {s.github_token}", "Accept": "application/vnd.github+json"},
            json={"ref": s.github_ref, "inputs": {"mode": "scan-and-report" if body.send_report else "scan",
                                                  "countries": ",".join(body.countries or [])}}, timeout=20,
        )
        if r.status_code >= 300:
            raise HTTPException(502, f"GitHub dispatch failed: HTTP {r.status_code}")
        return {"executor": "github", "message": "Scan dispatched to GitHub Actions; it appears in the log when it starts."}
    scan = ScanSession(trigger="manual", status="running", started_at=datetime.now(timezone.utc))
    db.add(scan)
    db.commit()
    threading.Thread(target=_background_scan, args=(scan.id, body.countries, body.send_report), daemon=True).start()
    return {"executor": "local", "scan_id": scan.id}


# ============================================================================ reports & fx
@api.get("/reports")
def list_reports(db: Session = Depends(get_db), limit: int = Query(20, ge=1, le=100)) -> list[dict]:
    return [{"id": r.id, "kind": r.kind, "recipient": r.recipient, "subject": r.subject, "status": r.status, "provider": r.provider,
             "attempts": r.attempts, "error": r.error, "created_at": _iso(r.created_at), "sent_at": _iso(r.sent_at), "scan_id": r.scan_id}
            for r in db.scalars(select(EmailReport).order_by(desc(EmailReport.created_at)).limit(limit))]


@api.get("/reports/preview", response_class=HTMLResponse)
def preview_report(db: Session = Depends(get_db)) -> HTMLResponse:
    from ..report.builder import build_context, render

    last_ok = db.scalar(select(ScanSession).where(ScanSession.status.in_(("success", "partial"))).order_by(desc(ScanSession.started_at)).limit(1))
    html, _ = render(build_context(db, last_ok))
    return HTMLResponse(html)


@api.get("/reports/{report_id}/html", response_class=HTMLResponse)
def report_html(report_id: int, db: Session = Depends(get_db)) -> HTMLResponse:
    r = db.get(EmailReport, report_id)
    if not r or not r.html:
        raise HTTPException(404)
    return HTMLResponse(r.html)


@api.post("/reports/send-test")
def send_test(db: Session = Depends(get_db)) -> dict:
    from ..report.builder import send_weekly_report

    last_ok = db.scalar(select(ScanSession).where(ScanSession.status.in_(("success", "partial"))).order_by(desc(ScanSession.started_at)).limit(1))
    rep = send_weekly_report(db, last_ok, kind="test")
    return {"id": rep.id, "status": rep.status, "error": rep.error, "recipient": rep.recipient}


@api.get("/exchange-rates")
def exchange_rates(db: Session = Depends(get_db)) -> list[dict]:
    return [{"date": r.rate_date.isoformat(), "base": r.base, "quote": r.quote, "rate": float(r.rate), "source": r.source}
            for r in db.scalars(select(ExchangeRate).order_by(desc(ExchangeRate.rate_date)).limit(30))]


# ============================================================================ internal (scheduler pings)
@internal.post("/tick", status_code=202)
def internal_tick() -> dict:
    """For an external cron that can only make HTTP calls (e.g. cron-job.org) with an always-on API host."""
    from ..scheduler import tick

    def _run() -> None:
        db = SessionLocal()
        try:
            tick(db)
        finally:
            db.close()

    threading.Thread(target=_run, daemon=True).start()
    return {"accepted": True}


@internal.get("/due")
def internal_due(db: Session = Depends(get_db)) -> dict:
    due, reason, key = is_due(db)
    try:
        running = bool(running_scan(db))
    except ScanAlreadyRunning:  # pragma: no cover
        running = True
    return {"due": due, "reason": reason, "week_key": key, "running": running}
