from datetime import datetime, timedelta, timezone
from decimal import Decimal as D

from sqlalchemy import func, select

from app.analytics import DealFilters, compare_product, history_stats, load_rows, overview
from app.connectors.base import AccessBlocked
from app.models import CurrentPrice, DealEvent, PriceHistory, Product, ProductVariant, ScanResult
from app.scanner import Scanner

from .conftest import factory_for, make_listing

T0 = datetime(2026, 11, 2, 7, 0, tzinfo=timezone.utc)


def scan(session, fx, data, when=T0, **kw):
    return Scanner(session, connector_factory=factory_for(data, kw.pop("complete", True)), fx=fx, now=when).run(trigger="cli", **kw)


def test_country_failures_are_isolated(session, fx):
    s = scan(session, fx, {
        "NL": [make_listing("NL")],
        "DE": RuntimeError("boom"),
        "FR": AccessBlocked("HTTP 403"),
        "ES": [make_listing("ES", price="89.95")],
        "PL": [make_listing("PL", price="399.00", original="509.00")],
    })
    st = {r.country_code: r.status for r in s.results}
    assert st == {"NL": "success", "DE": "failed", "FR": "blocked", "ES": "success", "PL": "success"}
    assert s.status == "partial"
    assert session.scalar(select(func.count(Product.id))) == 1  # same SKU in 3 countries = 1 product
    assert session.scalar(select(func.count(ProductVariant.id))) == 3


def test_same_sku_is_one_product_across_countries_and_comparison(session, fx):
    scan(session, fx, {
        "NL": [make_listing("NL", price="95.95")], "DE": [make_listing("DE", price="83.95")],
        "PL": [make_listing("PL", price="340.00", original="509.00")],
    })
    pid = session.scalar(select(Product.id))
    cmp = compare_product(session, pid)
    assert cmp["cheapest_country"] == "PL"  # 340 PLN / 4.25 = 80.00 EUR
    pl = next(o for o in cmp["offers"] if o["country"] == "PL")
    assert pl["price"] == 340.0 and pl["currency"] == "PLN" and pl["price_eur"] == 80.0
    assert cmp["spread_eur"] == round(95.95 - 80.0, 2)
    assert cmp["highest_discount_country"] == "PL"


def test_colourways_are_separate_products(session, fx):
    scan(session, fx, {"NL": [make_listing(sku="NI112N022-A11", price="59.95"), make_listing(sku="NI112N022-Q11", original=None, name="Nike Sportswear AIR FORCE 1 07 - Sneakers laag - black")]})
    rows = {r["sku"]: r for r in load_rows(session, DealFilters())}
    assert rows["NI112N022-A11"]["discount_pct"] > 40 and rows["NI112N022-Q11"]["discount_pct"] == 0
    assert rows["NI112N022-A11"]["colourway"] == "white" and rows["NI112N022-Q11"]["colourway"] == "black"


def test_duplicate_listing_in_one_scan_is_stored_once(session, fx):
    scan(session, fx, {"NL": [make_listing(), make_listing()]})
    assert session.scalar(select(func.count(PriceHistory.id))) == 1


def test_failed_scan_never_overwrites_history(session, fx):
    scan(session, fx, {"NL": [make_listing(price="95.95")]})
    before = session.scalar(select(CurrentPrice))
    s2 = scan(session, fx, {"NL": RuntimeError("network down")}, when=T0 + timedelta(days=7))
    assert s2.status == "failed"
    session.expire_all()
    cp = session.scalar(select(CurrentPrice))
    assert cp.price == before.price and session.scalar(select(func.count(PriceHistory.id))) == 1
    assert session.scalar(select(ProductVariant.listed)) is True


def test_invalid_prices_are_rejected_not_stored(session, fx):
    s = scan(session, fx, {"NL": [make_listing(price="0.50", original="120.00"), make_listing(sku="NI000A000-A11", price="95.95")]})
    res = next(r for r in s.results if r.country_code == "NL")
    assert res.rejected_records == 1 and res.products_updated == 1


def test_events_price_drop_new_discount_back_in_stock(session, fx):
    scan(session, fx, {"NL": [make_listing(price="119.95", original=None, in_stock=False, sizes=[])]})  # baseline
    s2 = scan(session, fx, {"NL": [make_listing(price="83.95", original="119.95")]}, when=T0 + timedelta(days=7))
    kinds = {e.kind for e in session.scalars(select(DealEvent).where(DealEvent.scan_id == s2.id))}
    assert {"new_discount", "price_drop", "back_in_stock"} <= kinds
    assert s2.new_discounts == 1
    cp = session.scalar(select(CurrentPrice))
    assert cp.previous_price_eur == D("119.95") and cp.discount_pct == D("30.01")


def test_baseline_scan_produces_no_events(session, fx):
    scan(session, fx, {"NL": [make_listing()]})
    assert session.scalar(select(func.count(DealEvent.id))) == 0


def test_delisting_only_after_complete_successful_scan(session, fx):
    many = [make_listing(sku=f"NI000A{i:03d}-A11") for i in range(10)]
    scan(session, fx, {"NL": many})
    # incomplete crawl that saw only 6 of 10: nothing is delisted
    scan(session, fx, {"NL": many[:6]}, when=T0 + timedelta(days=7), complete=False)
    assert session.scalar(select(func.count(ProductVariant.id)).where(ProductVariant.listed.is_(False))) == 0
    # complete crawl that saw 8 of 10: the 2 missing are delisted
    scan(session, fx, {"NL": many[:8]}, when=T0 + timedelta(days=14))
    assert session.scalar(select(func.count(ProductVariant.id)).where(ProductVariant.listed.is_(False))) == 2
    # a suspiciously small complete result (1 of 8) changes nothing
    scan(session, fx, {"NL": many[:1]}, when=T0 + timedelta(days=21))
    assert session.scalar(select(func.count(ProductVariant.id)).where(ProductVariant.listed.is_(False))) == 2


def test_missing_fx_rate_fails_poland_only(session):
    from app.fx import FxConverter

    s = Scanner(session, connector_factory=factory_for({"NL": [make_listing()], "PL": [make_listing("PL", price="300")]}),
                fx=FxConverter({}), now=T0).run(trigger="cli")
    st = {r.country_code: r.status for r in s.results}
    assert st["PL"] == "failed" and st["NL"] == "success"
    assert "exchange rate" in " ".join(session.scalar(select(ScanResult).where(ScanResult.country_code == "PL")).errors)


def test_prior_low_price_stored(session, fx):
    scan(session, fx, {"PL": [make_listing("PL", price="75", original="249", extra={"prior_low_price": D("87.00"), "reference_label": "Cena regularna"})]})
    r = load_rows(session, DealFilters())[0]
    assert r["discount_pct"] == 69.88 and r["prior_low_price"] == 87.0
    assert r["discount_vs_prior_low_pct"] == 13.79 and r["reference_label"] == "Cena regularna"


def test_history_claims_need_enough_observations():
    now = datetime(2026, 11, 20, tzinfo=timezone.utc)
    pts = [{"t": (now - timedelta(days=d)).isoformat(), "price_eur": p, "discount_pct": 0.0} for d, p in [(21, 120.0), (14, 110.0), (7, 100.0), (0, 90.0)]]
    st = history_stats(pts, now=now)
    assert st["all_time_low"] is True and st["below_30d_avg"] is True and st["below_90d_avg"] is None  # 90-day needs 45 days span
    assert st["lowest_eur"] == 90.0 and st["highest_eur"] == 120.0 and st["average_eur"] == 105.0
    few = history_stats(pts[-2:], now=now)
    assert few["all_time_low"] is None and few["below_30d_avg"] is None


def test_overview_counts(session, fx):
    scan(session, fx, {"NL": [make_listing(price="59.95"), make_listing(sku="NI000B000-A11", price="99.95", original="109.95"),
                              make_listing(sku="NI000C000-A11", original=None)]})
    o = overview(session)
    assert o["products_tracked"] == 3 and o["discounted_products"] == 1 or o["discounted_products"] == 1
    assert o["discounts_30_plus"] == 1 and o["operational"] is True and o["sample_mode"] is False
    assert o["biggest_discount"]["sku"] == "NI112N022-A11"


def test_sample_data_is_hidden_once_real_data_exists(session, fx):
    from app.connectors.sample import SampleConnector

    Scanner(session, connector_factory=lambda n, c, s: SampleConnector(), fx=fx, now=T0).run(trigger="cli", connector_override="sample")
    assert overview(session)["sample_mode"] is True
    assert all(r["is_sample"] for r in load_rows(session, DealFilters()))
    scan(session, fx, {"NL": [make_listing()]}, when=T0 + timedelta(days=1))
    rows = load_rows(session, DealFilters())
    assert rows and not any(r["is_sample"] for r in rows)
