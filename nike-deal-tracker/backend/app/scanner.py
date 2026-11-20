"""The scan pipeline: collect -> identify -> classify -> price -> history -> events.

Guarantees
----------
* Countries are independent: a failure in one never stops the others.
* Only validated observations are written. A failed or partial scan never
  overwrites a valid current price with a missing value, and never deletes history.
* A product is only marked "no longer listed" after a *complete* successful scan of
  that country that found at least half of the previously listed products.
* Each (variant, scan) pair is stored once in the history (duplicate prevention).
"""
from __future__ import annotations

import hashlib
import logging
import traceback
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from .catalog.classifier import CompiledPool, classify, compile_franchises, normalise
from .catalog.franchises import FranchiseDef
from .config import Settings, get_settings
from .connectors.base import AccessBlocked, Connector, ConnectorNotConfigured, CountryConfig, RawListing
from .connectors.registry import build_connector
from .fx import FxConverter, FxUnavailable
from .models import (
    Country,
    CurrentPrice,
    DealEvent,
    Franchise,
    PriceHistory,
    Product,
    ProductAvailability,
    ProductVariant,
    ScanResult,
    ScanSession,
)
from .pricing import discount_amount, discount_pct, money, validate_prices

log = logging.getLogger(__name__)

SIGNIFICANT_DISCOUNT = Decimal("10")
PRICE_DROP_MIN_PCT = Decimal("1")
STALE_RUNNING_AFTER = timedelta(hours=6)

ConnectorFactory = Callable[[str, CountryConfig, Settings], Connector]


class ScanAlreadyRunning(RuntimeError):
    pass


def week_key_for(dt: datetime, tz: str = "Europe/Amsterdam") -> str:
    local = dt.astimezone(ZoneInfo(tz))
    y, w, _ = local.isocalendar()
    return f"{y}-W{w:02d}"


def running_scan(db: Session) -> ScanSession | None:
    s = db.scalar(select(ScanSession).where(ScanSession.status == "running").order_by(ScanSession.id.desc()).limit(1))
    if s and _aware(s.started_at) < datetime.now(timezone.utc) - STALE_RUNNING_AFTER:
        s.status, s.error, s.finished_at = "failed", "marked stale (process died?)", datetime.now(timezone.utc)
        db.commit()
        return None
    return s


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def franchise_pool(db: Session) -> tuple[CompiledPool, dict[str, Franchise]]:
    rows = list(db.scalars(select(Franchise).where(Franchise.active.is_(True))))
    defs = [FranchiseDef(f.slug, f.name, f.group, f.priority, list(f.patterns or []), f.specificity) for f in rows]
    return compile_franchises(defs), {f.slug: f for f in rows}


def match_key_for(listing: RawListing) -> str:
    if listing.sku:
        return listing.sku.upper()
    h = hashlib.sha1(f"{listing.country}|{normalise(listing.name)}|{normalise(listing.colour)}".encode()).hexdigest()[:20]
    return f"X-{listing.country}-{h}"


@dataclass
class CountryCounters:
    found: int = 0
    updated: int = 0
    new_products: int = 0
    new_discounts: int = 0
    rejected: int = 0


class Scanner:
    def __init__(self, db: Session, settings: Settings | None = None, *, connector_factory: ConnectorFactory | None = None,
                 fx: FxConverter | None = None, now: datetime | None = None) -> None:
        self.db = db
        self.settings = settings or get_settings()
        self.connector_factory = connector_factory or build_connector
        self.fx = fx
        self.now = now
        self.pool, self.franchises = franchise_pool(db)
        # built-in definitions carry tuned search queries; custom ones search by name
        from .catalog.franchises import FRANCHISES

        builtin = {f.slug for f in FRANCHISES}
        self.search_defs = [f for f in FRANCHISES if f.slug in self.franchises] + [
            FranchiseDef(f.slug, f.name, f.group, f.priority, list(f.patterns or []), f.specificity)
            for f in self.franchises.values() if f.slug not in builtin
        ]

    def _now(self) -> datetime:
        return self.now or datetime.now(timezone.utc)

    # ------------------------------------------------------------------ public
    def run(self, *, trigger: str = "manual", countries: list[str] | None = None, connector_override: str | None = None,
            week_key: str | None = None, scan: ScanSession | None = None) -> ScanSession:
        if scan is None:
            if running_scan(self.db):
                raise ScanAlreadyRunning("a scan is already running")
            scan = ScanSession(trigger=trigger, status="running", started_at=self._now(), week_key=week_key,
                               is_sample=connector_override == "sample")
            self.db.add(scan)
            self.db.commit()
        if self.fx is None:
            self.fx = FxConverter.for_scan(self.db, try_refresh=connector_override != "sample")
        q = select(Country).where(Country.enabled.is_(True)).order_by(Country.code)
        targets = [c for c in self.db.scalars(q) if not countries or c.code in countries]
        for country in targets:
            self._scan_country(scan, country, connector_override)
        self._finish(scan)
        return scan

    # ------------------------------------------------------------------ per country
    def _scan_country(self, scan: ScanSession, country: Country, override: str | None) -> None:
        name = override or country.connector or self.settings.connector_for(country.code)
        result = ScanResult(scan_id=scan.id, country_code=country.code, connector=name, status="running", started_at=self._now())
        self.db.add(result)
        self.db.commit()
        cfg = CountryConfig(country.code, country.domain, country.currency, country.language, country.nike_path, country.shipping_note)
        counters = CountryCounters()
        connector: Connector | None = None
        seen_variant_ids: set[int] = set()
        baseline = self._is_baseline(country.code, scan.id)
        try:
            if name == "disabled":
                raise ConnectorNotConfigured("connector disabled for this country")
            if country.currency != "EUR" and not self.fx.has(country.currency):  # type: ignore[union-attr]
                raise FxUnavailable(f"no recent EUR/{country.currency} exchange rate; refusing to store unconverted prices")
            if self.connector_factory is build_connector:
                connector = build_connector(name, cfg, self.settings, self.search_defs)
            else:
                connector = self.connector_factory(name, cfg, self.settings)
            for listing in connector.collect(cfg):
                counters.found += 1
                try:
                    with self.db.begin_nested():
                        vid = self._process(scan, cfg, listing, counters, baseline)
                    if vid:
                        seen_variant_ids.add(vid)
                except Exception as e:  # one bad record never kills the country
                    counters.rejected += 1
                    if len(result.errors or []) < 50:
                        result.errors = [*(result.errors or []), f"record {listing.sku or listing.name[:40]}: {e}"]
            stats = connector.stats
            result.errors = [*(result.errors or []), *stats.errors[:50]]
            result.requests_made = stats.requests
            counters.rejected += stats.rejected
            if counters.updated == 0:
                result.status = "failed"
                result.errors = [*(result.errors or []), "no valid products collected"]
            elif not stats.complete or stats.errors:
                result.status = "partial"
            else:
                result.status = "success"
            if result.status == "success":
                self._mark_delisted(cfg.code, seen_variant_ids)
        except ConnectorNotConfigured as e:
            result.status = "skipped"
            result.errors = [*(result.errors or []), str(e)]
        except AccessBlocked as e:
            result.status = "blocked"
            result.errors = [*(result.errors or []), str(e)]
            if connector is not None:
                result.requests_made = connector.stats.requests
        except Exception as e:
            log.exception("country %s failed", country.code)
            result.status = "failed"
            result.errors = [*(result.errors or []), f"{type(e).__name__}: {e}", traceback.format_exc(limit=3)[-800:]]
        finally:
            if connector is not None:
                try:
                    connector.close()
                except Exception:  # pragma: no cover
                    pass
        result.products_found = counters.found
        result.products_updated = counters.updated
        result.new_products = counters.new_products
        result.new_discounts = counters.new_discounts
        result.rejected_records = counters.rejected
        result.finished_at = self._now()
        self.db.commit()
        log.info("scan %s %s: %s found=%s updated=%s new=%s deals=%s", scan.id, country.code, result.status,
                 counters.found, counters.updated, counters.new_products, counters.new_discounts)

    def _is_baseline(self, country: str, scan_id: int) -> bool:
        prev = self.db.scalar(
            select(func.count(ScanResult.id)).where(
                ScanResult.country_code == country, ScanResult.scan_id != scan_id,
                ScanResult.status.in_(("success", "partial")),
            )
        )
        return not prev

    def _mark_delisted(self, country: str, seen: set[int]) -> None:
        listed = list(self.db.scalars(select(ProductVariant.id).where(ProductVariant.country_code == country, ProductVariant.listed.is_(True))))
        if not listed or len(seen) < 0.5 * len(listed):
            return  # suspiciously small result: don't infer anything
        missing = [v for v in listed if v not in seen]
        if missing:
            self.db.execute(update(ProductVariant).where(ProductVariant.id.in_(missing)).values(listed=False))

    # ------------------------------------------------------------------ per listing
    def _process(self, scan: ScanSession, cfg: CountryConfig, li: RawListing, c: CountryCounters, baseline: bool) -> int | None:
        now = self._now()
        ok, reason = validate_prices(li.price, li.original_price)
        if not ok:
            raise ValueError(f"rejected price: {reason}")
        currency = (li.currency or cfg.currency).upper()
        if currency != cfg.currency:
            raise ValueError(f"currency {currency} does not match shop currency {cfg.currency}")
        price = money(li.price)
        original = money(li.original_price) if li.original_price is not None and li.original_price > li.price else None  # type: ignore[operator]
        rate = self.fx.rate(currency)  # type: ignore[union-attr]
        price_eur = self.fx.to_eur(price, currency)  # type: ignore[union-attr]
        original_eur = self.fx.to_eur(original, currency) if original else None  # type: ignore[union-attr]
        pct = discount_pct(original, price)
        prior_low = li.extra.get("prior_low_price") if li.extra else None
        prior_low = money(Decimal(prior_low)) if prior_low is not None and Decimal(prior_low) > price else None  # type: ignore[operator]
        prior_low_eur = self.fx.to_eur(prior_low, currency) if prior_low else None  # type: ignore[union-attr]

        # ---- product (one per config SKU / colourway)
        key = match_key_for(li)
        product = self.db.scalar(select(Product).where(Product.match_key == key))
        cls = classify(li.name, colour=li.colour, category_hint=li.category_hint, gender_hint=li.gender_hint, url=li.url, pool=self.pool)
        fr = self.franchises.get(cls.franchise_slug) if cls.franchise_slug else None
        if product is None:
            product = Product(
                match_key=key, sku=li.sku, brand="Jordan" if (li.brand or "").lower().startswith("jordan") else "Nike",
                franchise_id=fr.id if fr else None, model=cls.model, name=li.name, colourway=cls.colourway,
                category=cls.category, subcategory=cls.subcategory, gender=cls.gender, image_url=li.image_url,
                is_sample=li.is_sample, first_seen_at=now, updated_at=now,
            )
            self.db.add(product)
            self.db.flush()
        else:
            if li.image_url and not product.image_url:
                product.image_url = li.image_url
            if fr and product.franchise_id is None:
                product.franchise_id = fr.id
            if cls.colourway and not product.colourway:
                product.colourway = cls.colourway
            if product.category == "other" and cls.category != "other":
                product.category, product.subcategory = cls.category, cls.subcategory
            if product.gender == "unisex" and cls.gender != "unisex":
                product.gender = cls.gender
            product.updated_at = now

        # ---- variant (product in this country)
        variant = self.db.scalar(select(ProductVariant).where(ProductVariant.product_id == product.id, ProductVariant.country_code == cfg.code))
        is_new_variant = variant is None
        if variant is None:
            variant = ProductVariant(product_id=product.id, country_code=cfg.code, local_name=li.name, url=li.url,
                                     currency=currency, source=li.source, first_seen_at=now, last_seen_at=now, listed=True)
            self.db.add(variant)
            self.db.flush()
            c.new_products += 1
        else:
            variant.local_name, variant.url, variant.source, variant.last_seen_at, variant.listed = li.name, li.url or variant.url, li.source, now, True

        # duplicate prevention: one observation per variant per scan
        dup = self.db.scalar(select(PriceHistory.id).where(PriceHistory.variant_id == variant.id, PriceHistory.scan_id == scan.id))
        if dup:
            return variant.id

        prev = variant.current
        prev_hist = list(self.db.scalars(select(PriceHistory.price).where(PriceHistory.variant_id == variant.id)))
        in_stock = li.in_stock if li.in_stock is not None else (bool(li.sizes) if li.sizes_known else True)
        sizes = li.sizes if li.sizes_known else (list(prev.sizes) if prev else [])

        self.db.add(PriceHistory(
            variant_id=variant.id, scan_id=scan.id, observed_at=now, currency=currency, price=price, original_price=original,
            price_eur=price_eur, original_price_eur=original_eur, discount_pct=pct, in_stock=in_stock,
            size_count=len(sizes), fx_rate=rate, prior_low_price=prior_low, source=li.source,
        ))

        # ---- events
        def event(kind: str, old: Decimal | None, new: Decimal | None) -> None:
            self.db.add(DealEvent(scan_id=scan.id, variant_id=variant.id, kind=kind, old_value=old, new_value=new, created_at=now))

        if not baseline:
            if is_new_variant:
                event("new_product", None, price_eur)
            prev_pct = Decimal(prev.discount_pct) if prev else None
            if pct >= SIGNIFICANT_DISCOUNT and (prev_pct is None or prev_pct < SIGNIFICANT_DISCOUNT):
                event("new_discount", prev_pct, pct)
                c.new_discounts += 1
            if prev and prev.price > 0 and price < prev.price and (prev.price - price) / prev.price * 100 >= PRICE_DROP_MIN_PCT:
                event("price_drop", money(Decimal(prev.price_eur)), price_eur)
            if prev and not prev.in_stock and in_stock:
                event("back_in_stock", None, price_eur)
            if len(prev_hist) >= 3:
                lowest = min(Decimal(p) for p in prev_hist)
                if price < lowest:
                    event("all_time_low", money(lowest), price)
                ordered = sorted(Decimal(p) for p in prev_hist)
                median = ordered[len(ordered) // 2]
                if price <= median * Decimal("0.7"):
                    event("unusually_low", money(median), price)

        # discount streak
        if pct >= SIGNIFICANT_DISCOUNT:
            if variant.discounted_since is None:
                variant.discounted_since = now
        else:
            variant.discounted_since = None

        # ---- current price (only ever replaced by a valid observation)
        if prev is None:
            prev = CurrentPrice(variant_id=variant.id)
            self.db.add(prev)
            previous_eur = None
        else:
            previous_eur = prev.price_eur
        prev.currency, prev.price, prev.original_price = currency, price, original
        prev.price_eur, prev.original_price_eur, prev.discount_pct = price_eur, original_eur, pct
        prev.discount_amount_eur = discount_amount(original_eur, price_eur)
        prev.in_stock, prev.sizes, prev.observed_at, prev.scan_id = in_stock, sizes, now, scan.id
        prev.previous_price_eur = previous_eur
        prev.prior_low_price, prev.prior_low_price_eur = prior_low, prior_low_eur
        prev.reference_label = (li.extra.get("reference_label") or None) if li.extra else None
        prev.price_varies = bool(li.extra.get("price_varies")) if li.extra else False
        if li.extra and li.extra.get("shipping"):
            variant.shipping = li.extra["shipping"]

        # ---- per-size availability
        if li.sizes_known:
            known = {a.size: a for a in self.db.scalars(select(ProductAvailability).where(ProductAvailability.variant_id == variant.id))}
            current = set(li.sizes)
            for s in current:
                a = known.get(s)
                if a is None:
                    self.db.add(ProductAvailability(variant_id=variant.id, size=s, in_stock=True, observed_at=now))
                else:
                    a.in_stock, a.observed_at = True, now
            for s, a in known.items():
                if s not in current and a.in_stock:
                    a.in_stock, a.observed_at = False, now
        c.updated += 1
        return variant.id

    # ------------------------------------------------------------------ finish
    def _finish(self, scan: ScanSession) -> None:
        self.db.refresh(scan)
        results = scan.results
        statuses = [r.status for r in results]
        good = [s for s in statuses if s in ("success", "partial")]
        if not results or not good:
            scan.status = "failed"
        elif all(s == "success" for s in statuses):
            scan.status = "success"
        else:
            scan.status = "partial"
        scan.products_found = sum(r.products_found for r in results)
        scan.products_updated = sum(r.products_updated for r in results)
        scan.new_products = sum(r.new_products for r in results)
        scan.new_discounts = sum(r.new_discounts for r in results)
        scan.finished_at = self._now()
        if scan.status == "failed":
            scan.error = "; ".join(f"{r.country_code}: {r.status} ({(r.errors or ['-'])[0][:160]})" for r in results) or "no countries enabled"
        self.db.commit()


def run_scan(db: Session, **kwargs) -> ScanSession:
    ctor_keys = {"settings", "connector_factory", "fx", "now"}
    scanner = Scanner(db, **{k: v for k, v in kwargs.items() if k in ctor_keys})
    return scanner.run(**{k: v for k, v in kwargs.items() if k not in ctor_keys})


def reclassify_all(db: Session) -> int:
    """Re-run identification on stored products (after classifier or franchise changes)."""
    pool, by_slug = franchise_pool(db)
    changed = 0
    for p in db.scalars(select(Product)):
        c = classify(p.name, pool=pool)
        fid = by_slug[c.franchise_slug].id if c.franchise_slug in by_slug else None
        new = {"franchise_id": fid, "category": c.category, "subcategory": c.subcategory, "model": c.model,
               "colourway": c.colourway or p.colourway, "gender": c.gender if c.gender != "unisex" else p.gender}
        if any(getattr(p, k) != v for k, v in new.items()):
            for k, v in new.items():
                setattr(p, k, v)
            changed += 1
    db.commit()
    return changed
