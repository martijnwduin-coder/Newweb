"""Connector tests. Fixtures are trimmed copies of real Zalando pages (structure as of Nov 2026)."""
import gzip
from decimal import Decimal as D

import httpx
import pytest

from app.connectors.base import AccessBlocked, ConnectorError, CountryConfig
from app.connectors.feed import FeedConnector, decode_feed, parse_feed
from app.connectors.http import PoliteClient
from app.connectors.zalando_web import (
    CrawlPlan,
    ZalandoWebConnector,
    decode_display_price,
    parse_catalog_page,
    parse_detail_page,
)

from .conftest import fixture_text

NL = CountryConfig("NL", "www.zalando.nl", "EUR", "nl-NL")
PL = CountryConfig("PL", "www.zalando.pl", "PLN", "pl-PL")


# ------------------------------------------------------------------ Zalando parsing
def test_catalog_page_nl():
    listings, links = parse_catalog_page(fixture_text("zalando_nl_catalog.html"), NL)
    by = {l.sku: l for l in listings}
    assert len(listings) == 5
    socks = by["N1244D06L-A11"]
    assert socks.price == D("14.95") and socks.original_price is None and socks.category_hint == "socks"
    p6000 = by["NI115P032-Q11"]
    assert (p6000.price, p6000.original_price) == (D("71.95"), D("129.95"))
    assert p6000.extra["reference_label"] == "Gemiddelde prijs" and p6000.extra["price_varies"] is True
    assert p6000.name.startswith("Nike Sportswear P-6000") and p6000.url.endswith("ni115p032-q11.html")
    assert p6000.image_url.startswith("https://img01.ztat.net/")
    omnibus = by["NI115P02Z-C11"]  # "Normale prijs" 129,95 and "Vorige laagste prijs" 71,95
    assert omnibus.original_price == D("129.95") and omnibus.extra["prior_low_price"] == D("71.95")
    assert any(l.endswith("ni112o0bv-q11.html") for l in links)  # unpriced product link discovered


def test_catalog_page_pl_currency_and_prior_low():
    listings, _ = parse_catalog_page(fixture_text("zalando_pl_sale.html"), PL)
    first = listings[0]
    assert first.currency == "PLN"
    assert first.price == D("75") and first.original_price == D("249")
    assert first.extra["prior_low_price"] == D("87.00")
    assert first.extra["reference_label"] == "Cena regularna"


def test_foreign_currency_rejected():
    listings, _ = parse_catalog_page(fixture_text("zalando_pl_sale.html"), NL)
    assert listings == []  # PLN offers can never be stored as EUR


def test_detail_page_sizes_stock_shipping():
    url = "https://www.zalando.nl/nike-sportswear-air-force-1-07-sneakers-laag-white-ni112n022-a11.html"
    d = parse_detail_page(fixture_text("zalando_nl_pdp.html"), NL, url)
    assert d.sku == "NI112N022-A11"
    assert d.price == D("95.95") and d.original_price == D("119.95")
    assert d.sizes_known and "40.5" not in d.sizes and "40" in d.sizes  # fixture marks 40.5 as out of stock
    assert d.in_stock is True
    assert d.extra["shipping"]["destination"] == "NL" and d.extra["shipping"]["cost"] == 0.0


def test_minor_units_only_used_when_verified():
    good = decode_display_price({"displayPrice": {"trackingCurrentAmount": 71.95, "promotional": {"amount": 7195}, "original": {"amount": 12995, "currency": "EUR"}}})
    assert (good.current, good.original, good.method) == (D("71.95"), D("129.95"), "amount-verified")
    bad = decode_display_price({"displayPrice": {"trackingCurrentAmount": 7.19, "promotional": {"amount": 7195}, "original": {"amount": 12995}}})
    assert bad.current is None and bad.warnings  # scale can't be verified -> no price at all
    no_tracking = decode_display_price({"displayPrice": {"promotional": {"amount": 7195}, "original": {"amount": 12995}}})
    assert no_tracking.current is None


def test_connector_crawl_with_mock_transport():
    catalog = fixture_text("zalando_nl_catalog.html")
    pdp = fixture_text("zalando_nl_pdp.html")
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(str(request.url))
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nDisallow: /api/*\nDisallow: /cart/*\n")
        if request.url.path.endswith(".html"):
            return httpx.Response(200, text=pdp)
        return httpx.Response(200, text=catalog)

    client = PoliteClient(user_agent="test", min_delay=0, cache_dir=None, transport=httpx.MockTransport(handler), sleep=lambda s: None)
    plan = CrawlPlan(brand_paths=("/nike/",), sale_pages=2, popular_pages=1, franchise_queries=[("air-force-1", "Air Force 1", 1)], detail_pages=2)
    con = ZalandoWebConnector(client, plan)
    out = {l.sku: l for l in con.collect(NL)}
    assert "NI112N022-A11" in out and out["NI112N022-A11"].extra.get("sizes_source") == "product-page"
    assert any("order=sale" in u for u in seen) and any("q=Air+Force+1" in u for u in seen)
    assert all("/api/" not in u for u in seen)
    assert con.stats.requests == len(seen)


# ------------------------------------------------------------------ polite client
def _client(handler, **kw):
    return PoliteClient(user_agent="test-bot", min_delay=0, cache_dir=None, transport=httpx.MockTransport(handler), sleep=lambda s: None, **kw)


def test_blocked_response_raises_and_is_not_retried():
    calls = []

    def handler(request):
        calls.append(request.url.path)
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nAllow: /\n")
        return httpx.Response(403, headers={"x-edge-error": "halt"}, text="Not Found")

    c = _client(handler)
    with pytest.raises(AccessBlocked):
        c.get_text("https://www.zalando.nl/nike/")
    assert calls.count("/nike/") == 1


def test_robots_blocked_means_no_crawl():
    c = _client(lambda r: httpx.Response(403, text="nope"))
    with pytest.raises(AccessBlocked):
        c.get_text("https://www.zalando.nl/nike/")


def test_robots_disallow_respected():
    def handler(request):
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nDisallow: /nike/\n")
        raise AssertionError("must not fetch a disallowed URL")

    with pytest.raises(ConnectorError, match="robots"):
        _client(handler).get_text("https://www.zalando.nl/nike/")


def test_transient_errors_are_retried():
    state = {"n": 0}

    def handler(request):
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        state["n"] += 1
        return httpx.Response(503) if state["n"] < 3 else httpx.Response(200, text="ok")

    assert _client(handler, max_retries=3).get_text("https://x.example/p") == "ok"
    assert state["n"] == 3


def test_cache_avoids_second_request(tmp_path):
    state = {"n": 0}

    def handler(request):
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        state["n"] += 1
        return httpx.Response(200, text="page")

    c = PoliteClient(user_agent="t", min_delay=0, cache_dir=str(tmp_path), transport=httpx.MockTransport(handler), sleep=lambda s: None)
    c.get_text("https://x.example/a")
    c.get_text("https://x.example/a")
    assert state["n"] == 1


def test_rate_limit_waits_between_requests():
    waits = []
    c = PoliteClient(user_agent="t", min_delay=4, cache_dir=None, sleep=waits.append,
                     transport=httpx.MockTransport(lambda r: httpx.Response(404) if r.url.path == "/robots.txt" else httpx.Response(200, text="x")))
    c.get_text("https://x.example/a")
    c.get_text("https://x.example/b")
    assert waits and all(w >= 3.9 for w in waits)


# ------------------------------------------------------------------ authorised feed
AWIN_CSV = """aw_product_id,merchant_product_id,product_name,brand_name,search_price,rrp_price,currency,merchant_deep_link,aw_deep_link,merchant_image_url,colour,merchant_category,Fashion:size,Fashion:suitable_for,in_stock
1,NI112N022-A110060000,Nike Sportswear AIR FORCE 1 07 - Sneakers laag - white,Nike Sportswear,95.95,119.95,EUR,https://www.zalando.nl/x-ni112n022-a11.html,https://www.awin1.com/x,https://img/x.jpg,white,Sneakers,42,men,1
2,NI112N022-A110065000,Nike Sportswear AIR FORCE 1 07 - Sneakers laag - white,Nike Sportswear,95.95,119.95,EUR,https://www.zalando.nl/x-ni112n022-a11.html,https://www.awin1.com/x,https://img/x.jpg,white,Sneakers,43,men,0
3,NI112N022-A110070000,Nike Sportswear AIR FORCE 1 07 - Sneakers laag - white,Nike Sportswear,99.95,119.95,EUR,https://www.zalando.nl/x-ni112n022-a11.html,https://www.awin1.com/x,https://img/x.jpg,white,Sneakers,44,men,1
4,AD112N022-A11,adidas Originals SAMBA - Sneakers,adidas Originals,79.95,109.95,EUR,https://www.zalando.nl/samba-ad112n022-a11.html,,,white,Sneakers,42,men,1
5,NI999X999-A11,Nike Broken - Sneakers,Nike,,119.95,EUR,https://www.zalando.nl/b-ni999x999-a11.html,,,white,Sneakers,42,men,1
"""


def test_awin_feed_groups_sizes_and_filters_brand():
    listings, rejected = parse_feed(AWIN_CSV, NL, "awin")
    assert rejected == 1  # Nike row without price
    assert len(listings) == 1
    l = listings[0]
    assert l.sku == "NI112N022-A11" and l.price == D("95.95") and l.original_price == D("119.95")
    assert l.sizes == ["42", "44"] and l.in_stock is True  # size 43 is out of stock
    assert l.url.startswith("https://www.zalando.nl/")


def test_feed_connector_gzip():
    raw = gzip.compress(AWIN_CSV.encode())
    assert decode_feed(raw).startswith("aw_product_id")
    c = PoliteClient(user_agent="t", min_delay=0, cache_dir=None, transport=httpx.MockTransport(lambda r: httpx.Response(200, content=raw)), sleep=lambda s: None)
    out = list(FeedConnector(c, "https://productdata.awin.com/feed").collect(NL))
    assert len(out) == 1


def test_feed_connector_requires_url():
    from app.connectors.base import ConnectorNotConfigured

    with pytest.raises(ConnectorNotConfigured):
        list(FeedConnector(_client(lambda r: httpx.Response(200)), "").collect(NL))
