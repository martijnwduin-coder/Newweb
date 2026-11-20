"""Read-side logic: deal listing, ranking, cross-country comparison and price-history statistics."""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from .models import (
    CurrentPrice,
    DealEvent,
    Franchise,
    PriceHistory,
    Product,
    ProductVariant,
    ScanSession,
)
from .pricing import discount_band, discount_pct

GROUPS_FOOTWEAR_SUB = {"running": "running", "basketball": "basketball", "training": "training"}

# Thresholds before any historical claim is made
MIN_OBS_ALL_TIME = 3
MIN_SPAN_ALL_TIME_DAYS = 14
MIN_OBS_30D = 3
MIN_SPAN_30D_DAYS = 14
MIN_OBS_90D = 4
MIN_SPAN_90D_DAYS = 45


def _f(d) -> float | None:
    return None if d is None else float(d)


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def real_data_exists(db: Session) -> bool:
    return bool(db.scalar(select(func.count(Product.id)).where(Product.is_sample.is_(False))))


def sample_mode(db: Session) -> bool:
    """True when the only data in the database is labelled sample data."""
    return not real_data_exists(db) and bool(db.scalar(select(func.count(Product.id))))


# ---------------------------------------------------------------------------- rows
@dataclass
class DealFilters:
    min_discount: float | None = None
    max_discount: float | None = None
    max_price_eur: float | None = None
    countries: list[str] = field(default_factory=list)
    franchises: list[str] = field(default_factory=list)
    group: str | None = None
    categories: list[str] = field(default_factory=list)
    genders: list[str] = field(default_factory=list)
    size: str | None = None
    q: str | None = None
    in_stock_only: bool = True
    discounted_only: bool = False
    new_since: datetime | None = None
    product_ids: list[int] = field(default_factory=list)


def row_for(v: ProductVariant, cp: CurrentPrice, p: Product, f: Franchise | None) -> dict:
    pct = float(cp.discount_pct or 0)
    band = discount_band(pct)
    price_change = None
    if cp.previous_price_eur is not None:
        price_change = float(Decimal(cp.price_eur) - Decimal(cp.previous_price_eur))
    return {
        "variant_id": v.id, "product_id": p.id, "sku": p.sku, "name": p.name, "local_name": v.local_name,
        "model": p.model, "colourway": p.colourway, "category": p.category, "subcategory": p.subcategory,
        "gender": p.gender, "image_url": p.image_url, "is_sample": p.is_sample,
        "franchise": {"slug": f.slug, "name": f.name, "group": f.group, "priority": f.priority} if f else None,
        "group": nav_group(p, f),
        "country": v.country_code, "currency": cp.currency, "url": v.url, "listed": v.listed,
        "price": _f(cp.price), "original_price": _f(cp.original_price),
        "price_eur": _f(cp.price_eur), "original_price_eur": _f(cp.original_price_eur),
        "discount_pct": pct, "discount_amount_eur": _f(cp.discount_amount_eur) or 0.0,
        "band": band["key"], "band_label": band["label"], "flagged": band["flagged"],
        "in_stock": cp.in_stock, "sizes": list(cp.sizes or []), "observed_at": _aware(cp.observed_at).isoformat() if cp.observed_at else None,
        "previous_price_eur": _f(cp.previous_price_eur), "price_change_eur": price_change,
        "discounted_since": _aware(v.discounted_since).isoformat() if v.discounted_since else None,
        "first_seen_at": _aware(v.first_seen_at).isoformat() if v.first_seen_at else None,
        "prior_low_price": _f(cp.prior_low_price), "prior_low_price_eur": _f(cp.prior_low_price_eur),
        "discount_vs_prior_low_pct": float(discount_pct(cp.prior_low_price, cp.price)) if cp.prior_low_price else None,
        "reference_label": cp.reference_label, "price_varies": bool(cp.price_varies), "shipping": v.shipping,
    }


def nav_group(p: Product, f: Franchise | None) -> str:
    if p.category in ("apparel", "accessories"):
        return "apparel"
    if f is not None:
        return f.group
    if p.category == "footwear" and p.subcategory in GROUPS_FOOTWEAR_SUB:
        return GROUPS_FOOTWEAR_SUB[p.subcategory]
    return "other"


def load_rows(db: Session, flt: DealFilters | None = None, *, include_sample: bool | None = None) -> list[dict]:
    flt = flt or DealFilters()
    if include_sample is None:
        include_sample = not real_data_exists(db)
    q = (
        select(ProductVariant, CurrentPrice, Product, Franchise)
        .join(CurrentPrice, CurrentPrice.variant_id == ProductVariant.id)
        .join(Product, Product.id == ProductVariant.product_id)
        .outerjoin(Franchise, Franchise.id == Product.franchise_id)
        .where(ProductVariant.listed.is_(True))
    )
    if not include_sample:
        q = q.where(Product.is_sample.is_(False))
    if flt.min_discount is not None:
        q = q.where(CurrentPrice.discount_pct >= flt.min_discount)
    if flt.max_discount is not None:
        q = q.where(CurrentPrice.discount_pct <= flt.max_discount)
    if flt.discounted_only:
        q = q.where(CurrentPrice.discount_pct >= 10)
    if flt.max_price_eur is not None:
        q = q.where(CurrentPrice.price_eur <= flt.max_price_eur)
    if flt.countries:
        q = q.where(ProductVariant.country_code.in_([c.upper() for c in flt.countries]))
    if flt.franchises:
        q = q.where(Franchise.slug.in_(flt.franchises))
    if flt.categories:
        q = q.where(Product.category.in_(flt.categories))
    if flt.genders:
        q = q.where(Product.gender.in_(flt.genders))
    if flt.in_stock_only:
        q = q.where(CurrentPrice.in_stock.is_(True))
    if flt.product_ids:
        q = q.where(Product.id.in_(flt.product_ids))
    if flt.q:
        like = f"%{flt.q.strip().lower()}%"
        q = q.where(func.lower(Product.name).like(like) | func.lower(ProductVariant.local_name).like(like) | func.lower(func.coalesce(Product.sku, "")).like(like))
    rows = [row_for(v, cp, p, f) for v, cp, p, f in db.execute(q)]
    if flt.group:
        rows = [r for r in rows if r["group"] == flt.group]
    if flt.size:
        s = flt.size.strip().lower()
        rows = [r for r in rows if any(str(x).strip().lower() == s for x in r["sizes"])]
    if flt.new_since:
        since = flt.new_since
        rows = [r for r in rows if r["discounted_since"] and datetime.fromisoformat(r["discounted_since"]) >= since]
    annotate_cross_country(rows, db, include_sample)
    for r in rows:
        r["score"] = deal_score(r)
    return rows


def annotate_cross_country(rows: list[dict], db: Session, include_sample: bool) -> None:
    """Mark which rows are the cheapest country for their SKU (using all listed in-stock variants)."""
    pids = {r["product_id"] for r in rows}
    if not pids:
        return
    q = (
        select(ProductVariant.product_id, ProductVariant.country_code, CurrentPrice.price_eur)
        .join(CurrentPrice, CurrentPrice.variant_id == ProductVariant.id)
        .where(ProductVariant.listed.is_(True), CurrentPrice.in_stock.is_(True), ProductVariant.product_id.in_(pids))
    )
    by_pid: dict[int, list[tuple[str, float]]] = defaultdict(list)
    for pid, cc, pe in db.execute(q):
        by_pid[pid].append((cc, float(pe)))
    for r in rows:
        offers = by_pid.get(r["product_id"], [])
        r["country_count"] = len(offers)
        if len(offers) >= 2:
            low = min(p for _, p in offers)
            r["cheapest_country"] = [c for c, p in offers if p == low]
            r["is_cheapest"] = r["country"] in r["cheapest_country"]
            r["savings_vs_highest_eur"] = round(max(p for _, p in offers) - r["price_eur"], 2)
        else:
            r["cheapest_country"] = [r["country"]] if offers else []
            r["is_cheapest"] = None
            r["savings_vs_highest_eur"] = 0.0


def deal_score(r: dict) -> float:
    """Ranking used for "Top deals".

    discount %                        x1.0
    + absolute saving (EUR, capped 100) x0.25
    + desirability: priority-1 franchise +15, priority-2 +7
    + cheapest of >=2 countries        +5
    + stock depth: +0.75 per size (max 8 sizes); out of stock -50
    """
    s = r["discount_pct"] + min(r["discount_amount_eur"], 100) * 0.25
    pr = r["franchise"]["priority"] if r["franchise"] else 3
    s += {1: 15, 2: 7}.get(pr, 0)
    if r.get("is_cheapest"):
        s += 5
    if not r["in_stock"]:
        s -= 50
    s += min(len(r["sizes"]), 8) * 0.75
    return round(s, 2)


SORTS = {
    "discount": (lambda r: (r["discount_pct"], r["discount_amount_eur"]), True),
    "price": (lambda r: r["price_eur"], False),
    "reduction": (lambda r: r["discount_amount_eur"], True),
    "price_drop": (lambda r: -(r["price_change_eur"] or 0), True),
    "newest": (lambda r: r["discounted_since"] or r["first_seen_at"] or "", True),
    "franchise": (lambda r: ((r["franchise"] or {}).get("name") or "~", -r["discount_pct"]), False),
    "country": (lambda r: (r["country"], -r["discount_pct"]), False),
    "score": (lambda r: r["score"], True),
}


def sort_rows(rows: list[dict], sort: str = "discount") -> list[dict]:
    key, rev = SORTS.get(sort, SORTS["discount"])
    return sorted(rows, key=key, reverse=rev)


# ---------------------------------------------------------------------------- comparison
def compare_product(db: Session, product_id: int) -> dict | None:
    p = db.get(Product, product_id)
    if p is None:
        return None
    variants = list(db.scalars(select(ProductVariant).options(joinedload(ProductVariant.current)).where(ProductVariant.product_id == product_id)))
    offers = []
    for v in variants:
        cp = v.current
        if cp is None:
            continue
        offers.append({
            "country": v.country_code, "currency": cp.currency, "price": _f(cp.price), "original_price": _f(cp.original_price),
            "price_eur": _f(cp.price_eur), "original_price_eur": _f(cp.original_price_eur), "discount_pct": float(cp.discount_pct),
            "in_stock": cp.in_stock, "listed": v.listed, "sizes": list(cp.sizes or []), "url": v.url, "local_name": v.local_name,
            "observed_at": _aware(cp.observed_at).isoformat(),
        })
    return {"product_id": p.id, "sku": p.sku, "name": p.name, "colourway": p.colourway, "image_url": p.image_url,
            "is_sample": p.is_sample, **summarise_offers(offers), "offers": sorted(offers, key=lambda o: o["price_eur"])}


def summarise_offers(offers: list[dict]) -> dict:
    live = [o for o in offers if o["in_stock"] and o["listed"]]
    if not live:
        return {"cheapest_country": None, "highest_discount_country": None, "lowest_price_eur": None,
                "highest_price_eur": None, "spread_eur": None, "spread_pct": None, "available_in": []}
    low = min(live, key=lambda o: o["price_eur"])
    high = max(live, key=lambda o: o["price_eur"])
    best_disc = max(live, key=lambda o: o["discount_pct"])
    spread = round(high["price_eur"] - low["price_eur"], 2)
    pcts = [o["discount_pct"] for o in live]
    return {
        "cheapest_country": low["country"], "highest_discount_country": best_disc["country"],
        "lowest_price_eur": low["price_eur"], "highest_price_eur": high["price_eur"], "spread_eur": spread,
        "spread_pct": round(spread / high["price_eur"] * 100, 1) if high["price_eur"] else None,
        "available_in": sorted(o["country"] for o in live),
        "discount_only_in_some": max(pcts) >= 10 and min(pcts) < 10,
        "price_differs": spread >= 0.01,
    }


def compare_list(db: Session, *, min_countries: int = 2, group: str | None = None, franchise: str | None = None,
                 q: str | None = None, limit: int = 200) -> list[dict]:
    include_sample = not real_data_exists(db)
    rows = load_rows(db, DealFilters(group=group, franchises=[franchise] if franchise else [], q=q, in_stock_only=False),
                     include_sample=include_sample)
    by_pid: dict[int, list[dict]] = defaultdict(list)
    for r in rows:
        by_pid[r["product_id"]].append(r)
    out = []
    for pid, rs in by_pid.items():
        if len(rs) < min_countries:
            continue
        offers = [{**r, "listed": r["listed"]} for r in rs]
        summary = summarise_offers(offers)
        if summary["lowest_price_eur"] is None:
            continue
        first = rs[0]
        out.append({
            "product_id": pid, "sku": first["sku"], "name": first["name"], "colourway": first["colourway"],
            "franchise": first["franchise"], "image_url": first["image_url"], "is_sample": first["is_sample"], **summary,
            "offers": sorted(({k: r[k] for k in ("country", "currency", "price", "original_price", "price_eur", "discount_pct", "in_stock", "url", "sizes")} for r in rs), key=lambda o: o["price_eur"]),
        })
    out.sort(key=lambda x: (x["spread_eur"] or 0), reverse=True)
    return out[:limit]


def country_summary(rows: list[dict]) -> list[dict]:
    by: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by[r["country"]].append(r)
    out = []
    for cc, rs in by.items():
        disc = [r for r in rs if r["discount_pct"] >= 10]
        out.append({
            "country": cc, "products": len(rs), "discounted": len(disc), "strong_deals": sum(1 for r in rs if r["discount_pct"] >= 30),
            "avg_discount": round(sum(r["discount_pct"] for r in disc) / len(disc), 1) if disc else 0.0,
            "max_discount": max((r["discount_pct"] for r in rs), default=0.0),
            "cheapest_wins": sum(1 for r in rs if r.get("is_cheapest")),
        })
    out.sort(key=lambda x: (x["avg_discount"] * (x["discounted"] ** 0.5)), reverse=True)
    return out


# ---------------------------------------------------------------------------- history
def history_for_product(db: Session, product_id: int, *, country: str | None = None, days: int | None = None) -> dict:
    q = (
        select(PriceHistory, ProductVariant.country_code)
        .join(ProductVariant, ProductVariant.id == PriceHistory.variant_id)
        .where(ProductVariant.product_id == product_id)
        .order_by(PriceHistory.observed_at)
    )
    if country:
        q = q.where(ProductVariant.country_code == country.upper())
    if days:
        q = q.where(PriceHistory.observed_at >= datetime.now(timezone.utc) - timedelta(days=days))
    series: dict[str, list[dict]] = defaultdict(list)
    for h, cc in db.execute(q):
        series[cc].append({
            "t": _aware(h.observed_at).isoformat(), "price": float(h.price), "currency": h.currency, "price_eur": float(h.price_eur),
            "original_price_eur": _f(h.original_price_eur), "discount_pct": float(h.discount_pct), "in_stock": h.in_stock,
        })
    stats = {cc: history_stats(pts) for cc, pts in series.items()}
    return {"product_id": product_id, "series": series, "stats": stats}


def history_stats(points: list[dict], now: datetime | None = None) -> dict:
    """Statistics + claims. A claim is ``None`` when there are not enough observations to make it."""
    if not points:
        return {"observations": 0}
    now = now or datetime.now(timezone.utc)
    prices = [p["price_eur"] for p in points]
    times = [datetime.fromisoformat(p["t"]) for p in points]
    current = prices[-1]
    span_days = (times[-1] - times[0]).days

    def window(days: int) -> list[tuple[datetime, float]]:
        cut = now - timedelta(days=days)
        return [(t, p) for t, p in zip(times, prices) if t >= cut]

    def claim_below_avg(days: int, min_obs: int, min_span: int) -> tuple[bool | None, float | None]:
        w = window(days)
        if len(w) < min_obs or (w[-1][0] - w[0][0]).days < min_span:
            return None, None
        avg = sum(p for _, p in w) / len(w)
        return current < avg - 0.005, round(avg, 2)

    atl = None
    if len(prices) >= MIN_OBS_ALL_TIME and span_days >= MIN_SPAN_ALL_TIME_DAYS:
        atl = current <= min(prices) + 0.001
    b30, avg30 = claim_below_avg(30, MIN_OBS_30D, MIN_SPAN_30D_DAYS)
    b90, avg90 = claim_below_avg(90, MIN_OBS_90D, MIN_SPAN_90D_DAYS)
    return {
        "observations": len(prices), "span_days": span_days, "current_eur": current,
        "lowest_eur": min(prices), "highest_eur": max(prices), "average_eur": round(sum(prices) / len(prices), 2),
        "first_observed": points[0]["t"], "last_observed": points[-1]["t"],
        "all_time_low": atl, "below_30d_avg": b30, "avg_30d": avg30, "below_90d_avg": b90, "avg_90d": avg90,
        "max_discount_pct": max(p["discount_pct"] for p in points),
    }


# ---------------------------------------------------------------------------- overview
def latest_scans(db: Session) -> tuple[ScanSession | None, ScanSession | None]:
    last = db.scalar(select(ScanSession).order_by(ScanSession.started_at.desc()).limit(1))
    last_ok = db.scalar(select(ScanSession).where(ScanSession.status.in_(("success", "partial"))).order_by(ScanSession.started_at.desc()).limit(1))
    return last, last_ok


def overview(db: Session) -> dict:
    include_sample = not real_data_exists(db)
    rows = load_rows(db, DealFilters(in_stock_only=False), include_sample=include_sample)
    in_stock = [r for r in rows if r["in_stock"]]
    disc = [r for r in in_stock if r["discount_pct"] >= 10]
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    nq = (
        select(func.count(func.distinct(DealEvent.variant_id))).join(ProductVariant, ProductVariant.id == DealEvent.variant_id)
        .join(Product, Product.id == ProductVariant.product_id)
        .where(DealEvent.kind == "new_discount", DealEvent.created_at >= week_ago)
    )
    if not include_sample:
        nq = nq.where(Product.is_sample.is_(False))
    new_deals = db.scalar(nq) or 0
    last, last_ok = latest_scans(db)
    real_ok = db.scalar(select(ScanSession).where(ScanSession.status.in_(("success", "partial")), ScanSession.is_sample.is_(False)).order_by(ScanSession.started_at.desc()).limit(1))
    biggest = max(disc, key=lambda r: (r["discount_pct"], r["discount_amount_eur"]), default=None)
    cheapest = min(disc, key=lambda r: r["price_eur"], default=None)
    return {
        "sample_mode": include_sample and bool(rows),
        "operational": bool(real_ok) and real_data_exists(db),
        "products_tracked": len({r["product_id"] for r in rows}),
        "listings_tracked": len(rows),
        "discounted_products": len({r["product_id"] for r in disc}),
        "discounts_30_plus": len({r["product_id"] for r in disc if r["discount_pct"] >= 30}),
        "new_deals_this_week": new_deals,
        "biggest_discount": biggest,
        "cheapest_product": cheapest,
        "last_scan": scan_brief(last),
        "last_successful_scan": scan_brief(last_ok),
        "countries": country_summary(in_stock),
        "top_deals": sort_rows(disc, "score")[:8],
    }


def scan_brief(s: ScanSession | None) -> dict | None:
    if s is None:
        return None
    return {"id": s.id, "status": s.status, "trigger": s.trigger, "started_at": _aware(s.started_at).isoformat(),
            "finished_at": _aware(s.finished_at).isoformat() if s.finished_at else None, "is_sample": s.is_sample,
            "products_found": s.products_found, "new_discounts": s.new_discounts}
