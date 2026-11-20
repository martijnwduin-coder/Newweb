"""Connector for public Zalando catalogue and product pages.

Compliance
----------
* robots.txt is checked for every URL (``PoliteClient``). As of Nov 2026 Zalando's
  robots.txt allows brand catalogue pages, ``?p=``/``?order=``/``?q=`` parameters (up to
  3 parameters) and product pages; it disallows ``/api/*``, carts, accounts etc.
* ≥ 4 s between requests per host by default, fixed page budgets, on-disk cache.
* Any 401/403, CAPTCHA or bot-protection response stops the country immediately
  (``AccessBlocked``). Nothing here tries to evade such protection.

Page format (verified against live pages, Nov 2026)
---------------------------------------------------
Catalogue and product pages embed a GraphQL cache:
``window.__hydrationDataConsume({"graphqlCache": {"<query>": {"data": {"product": {...}}}}})``.
A product object carries ``sku`` (config SKU, identical in every country), ``name``
(``MODEL - Type - colour``), ``brand.name``, ``uri``, ``silhouette``,
``navigationTargetGroup``, ``simples`` (sizes) and::

    "displayPrice": {"trackingCurrentAmount": 71.95,          # selling price, major units
                     "promotional": {"amount": 7195},          # minor units
                     "original": {"amount": 12995, "currency": "EUR"}}
    "displayPriceModule": {"prices": [... formatted texts, strike-through marks ...]}

Only the first ~24 cards of a catalogue page carry this data (the rest load in the
browser), so the crawl plan uses *sorted* and *searched* catalogue URLs to reach the
relevant products: ``?order=sale`` (biggest discounts first) and ``?q=<franchise>``.

Product pages additionally contain schema.org ``ProductGroup`` JSON-LD with one
``Product`` per size (price + availability) and ``OfferShippingDetails``.

Prices are only accepted when explicit: minor-unit amounts are used only after checking
that they match the major-unit ``trackingCurrentAmount`` (so the scale is verified, not
guessed); otherwise formatted strings ("119,99 €") are parsed. EU price-indication rules
mean Zalando may show a second crossed-out price, the *lowest price in the previous 30
days*; it is stored separately (``prior_low_price``) and never mixed up with the
original price.
"""
from __future__ import annotations

import html as htmllib
import json
import logging
import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any
from urllib.parse import quote_plus, urljoin

from ..catalog.classifier import URL_SKU_RE, extract_sku, is_nike
from ..pricing import parse_price, to_decimal
from .base import AccessBlocked, Connector, ConnectorError, CountryConfig, RawListing
from .http import PoliteClient

log = logging.getLogger(__name__)

SCRIPT_RE = re.compile(r"<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>", re.S | re.I)
PRODUCT_LINK_RE = re.compile(r'href="(?P<href>(?:https://www\.zalando\.[a-z]{2})?/[^"#?]*?-[a-z0-9]{9}-[a-z0-9]{3}\.html)"', re.I)
HYDRATION_MARKERS = ("__hydrationDataConsume(", "runtime['hydratePartial'](", "runtime[\"hydratePartial\"](")
SKU_ONLY_RE = re.compile(r"^[A-Z0-9]{9}-[A-Z0-9]{3}$")

# Zalando "silhouette" -> words the classifier understands
SILHOUETTE_HINTS = {
    "SNEAKER": "sneakers", "SHOE": "shoes", "LACE_UP": "shoes", "SLIP_ON": "shoes", "SANDAL": "sandals",
    "SANDALS": "sandals", "BEACH_SHOE": "slippers", "BOOTS": "boots", "ANKLE_BOOTS": "boots", "SPORTS_SHOE": "shoes",
    "STOCKING": "socks", "SOCKS": "socks", "HEADGEAR": "cap", "BAG": "bag", "BACKPACK": "backpack",
    "T_SHIRT_TOP": "t-shirt", "SHIRT": "shirt", "SWEATER": "sweater", "PULLOVER": "sweater", "CARDIGAN": "sweater",
    "JACKET": "jacket", "COAT": "coat", "VEST": "bodywarmer", "PANTS": "sweatpants", "TROUSERS": "sweatpants",
    "SHORTS": "shorts", "SKIRT": "rok", "DRESS": "jurk", "BRA": "sports bra", "UNDERWEAR": "underwear",
    "TRACKSUIT": "tracksuit", "SWIMWEAR": "bikini", "GLOVES": "gloves", "SCARF": "sjaal", "TIGHTS": "tights",
    "BELT": "accessory", "WALLET": "accessory", "SPORTS_EQUIPMENT": "accessory", "BALL": "accessory",
}
FROM_WORDS = {"vanaf", "ab", "à partir de", "a partir de", "desde", "od", "from", "dès"}
UPTO_WORDS = {"tot", "bis", "jusqu'à", "hasta", "do", "up to"}
GENDER_HINTS = {"MEN": "men", "WOMEN": "women", "KIDS": "kids", "BOYS": "kids", "GIRLS": "kids", "UNISEX": "unisex"}


# ============================================================================ JSON extraction
def extract_json_blobs(page: str) -> list[Any]:
    """All JSON payloads embedded in a page: hydration calls, application/json and ld+json scripts."""
    out: list[Any] = []
    dec = json.JSONDecoder()
    for marker in HYDRATION_MARKERS:
        start = 0
        while True:
            i = page.find(marker, start)
            if i < 0:
                break
            try:
                obj, _ = dec.raw_decode(page, i + len(marker))
                out.append(obj)
            except ValueError:
                pass
            start = i + len(marker)
    return out


def ld_json_blobs(page: str) -> list[Any]:
    out = []
    for m in SCRIPT_RE.finditer(page):
        if "ld+json" not in m.group("attrs").lower():
            continue
        body = m.group("body").strip()
        try:
            out.append(json.loads(body))
        except ValueError:
            try:
                out.append(json.loads(htmllib.unescape(body)))
            except ValueError:
                continue
    return out


def _walk(node: Any, depth: int = 0) -> Iterator[dict]:
    if depth > 60:
        return
    if isinstance(node, dict):
        yield node
        for v in node.values():
            yield from _walk(v, depth + 1)
    elif isinstance(node, list):
        for v in node:
            yield from _walk(v, depth + 1)


def _deep_merge(a: dict, b: dict) -> dict:
    out = dict(a)
    for k, v in b.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = _deep_merge(out[k], v)
        elif v is not None and (k not in out or out[k] in (None, [], {}, "")):
            out[k] = v
    return out


def _product_sku(d: dict) -> str | None:
    sku = d.get("sku")
    if isinstance(sku, str) and SKU_ONLY_RE.match(sku.upper()):
        return sku.upper()
    pid = d.get("id")
    if isinstance(pid, str) and pid.startswith("ern:product::"):
        s = pid.split("::", 1)[1].upper()
        if SKU_ONLY_RE.match(s):
            return s
    return None


def hydrated_products(blobs: list[Any]) -> dict[str, dict]:
    """Collect every product object in the GraphQL caches, merged per config SKU."""
    out: dict[str, dict] = {}
    for blob in blobs:
        for d in _walk(blob):
            if d.get("__typename") not in (None, "Product"):
                continue
            sku = _product_sku(d)
            if not sku:
                continue
            # skip bare references like {"__typename": "Product", "id": ..., "reason": null}
            if not any(k in d for k in ("name", "displayPrice", "simples", "simplesWithStock", "brand", "uri", "navigationTargetGroup", "silhouette")):
                continue
            out[sku] = _deep_merge(out.get(sku, {}), d)
    return out


# ============================================================================ price decoding
@dataclass
class DecodedPrice:
    current: Decimal | None = None
    original: Decimal | None = None
    prior_low: Decimal | None = None  # EU "lowest price in the last 30 days"
    currency: str | None = None
    reference_label: str | None = None
    price_varies: bool = False  # "from" price: differs per size
    method: str = ""
    warnings: list[str] = field(default_factory=list)


def _module_texts(d: dict) -> list[tuple[str, bool]]:
    mod = d.get("displayPriceModule") or {}
    out = []
    for pr in mod.get("prices") or []:
        block = (pr or {}).get("block") or {}
        for c in block.get("content") or []:
            t = c.get("text") if isinstance(c, dict) else None
            if isinstance(t, str):
                out.append((t.replace(" ", " ").strip(), bool((c.get("marks") or {}).get("isStrikeThrough"))))
    return out


def _amount(obj: Any) -> int | None:
    if isinstance(obj, dict):
        a = obj.get("amount")
        if isinstance(a, int) and not isinstance(a, bool):
            return a
    return None


def decode_display_price(d: dict) -> DecodedPrice:
    dp = d.get("displayPrice") or {}
    res = DecodedPrice()
    orig_obj, promo_obj = dp.get("original"), dp.get("promotional")
    if isinstance(orig_obj, dict) and isinstance(orig_obj.get("currency"), str):
        res.currency = orig_obj["currency"].upper()

    # 1) minor units, verified against the major-unit tracking amount
    tracking = dp.get("trackingCurrentAmount")
    cur_minor = _amount(promo_obj) if _amount(promo_obj) is not None else _amount(orig_obj)
    if isinstance(tracking, (int, float)) and not isinstance(tracking, bool) and cur_minor is not None:
        if abs(cur_minor / 100 - float(tracking)) < 0.006:
            res.current = Decimal(cur_minor) / 100
            o = _amount(orig_obj)
            if _amount(promo_obj) is not None and o is not None:
                res.original = Decimal(o) / 100
            res.method = "amount-verified"
        else:
            res.warnings.append("minor-unit amount does not match tracking amount; ignored")

    # 2) formatted strings (product pages): {"original": {"formatted": "€ 119,95"}, "promotional": {...}}
    if res.current is None:
        f_orig = parse_price(orig_obj.get("formatted")) if isinstance(orig_obj, dict) and orig_obj.get("formatted") else None
        f_promo = parse_price(promo_obj.get("formatted")) if isinstance(promo_obj, dict) and promo_obj.get("formatted") else None
        if f_promo is not None:
            res.current, res.original, res.method = f_promo, f_orig, "formatted"
        elif f_orig is not None:
            res.current, res.method = f_orig, "formatted"

    # 3) the visible price module: labels, "from" prices and the 30-day prior price
    texts = _module_texts(d)
    if texts:
        res.price_varies = any(t.lower() in FROM_WORDS for t, _ in texts)
        label = None
        visible_current = None
        others: list[tuple[Decimal, str | None]] = []  # every other price shown, with its label
        for t, _strike in texts:
            p = parse_price(t) if re.search(r"\d[.,]\d{2}", t) else None
            if p is None:
                if not re.match(r"^[-+]?\d+\s?%$", t) and t.lower() not in FROM_WORDS | UPTO_WORDS:
                    label = t.rstrip(":").strip()
                continue
            if visible_current is None and label is None:
                visible_current = p  # the first unlabelled price is the selling price
            else:
                others.append((p, label))
            label = None
        if res.current is None and visible_current is not None:
            res.current, res.method = visible_current, "module-text"
            higher = [p for p, _ in others if p > visible_current]
            if higher:
                res.original = max(higher)
        elif visible_current is not None and res.current is not None and visible_current != res.current:
            res.warnings.append(f"visible price {visible_current} differs from data price {res.current}")
        for p, lab in others:
            if res.original is not None and p == res.original:
                res.reference_label = (lab or "")[:160] or None
            elif res.current is not None and p > res.current and p != res.original:
                res.prior_low = p if res.prior_low is None else min(res.prior_low, p)
    # "Lowest price of the last 30 days" labelled explicitly as the reference (PL shows both)
    if res.original is not None and res.prior_low is not None and res.prior_low >= res.original:
        res.prior_low = None
    return res


# ============================================================================ listing builders
def _media(d: dict) -> str | None:
    for k in ("largeDefaultMedia", "mediumDefaultMedia", "extraLargeDefaultMedia", "smallDefaultMedia", "largePackshotImage", "mediumPackshotImage"):
        v = d.get(k)
        if isinstance(v, dict) and isinstance(v.get("uri"), str):
            return v["uri"]
    gal = d.get("gallery")
    if isinstance(gal, list):
        for g in gal:
            for k in ("galleryMedium", "gallerySmall"):
                if isinstance(g, dict) and isinstance(g.get(k), dict) and g[k].get("uri"):
                    return g[k]["uri"]
    return None


def listing_from_product(d: dict, country: CountryConfig) -> RawListing | None:
    sku = _product_sku(d)
    name = d.get("name") if isinstance(d.get("name"), str) else None
    brand = (d.get("brand") or {}).get("name") if isinstance(d.get("brand"), dict) else None
    if not sku or not name:
        return None
    name = name.replace(" ", " ").strip()
    price = decode_display_price(d)
    if price.current is None:
        return None
    if price.currency and price.currency != country.currency:
        return None  # a foreign-currency offer: never mix
    url = d.get("uri") if isinstance(d.get("uri"), str) else None
    url = urljoin(country.base_url, url) if url else f"{country.base_url}/{sku.lower()}.html"
    sizes = []
    for s in d.get("simples") or []:
        if isinstance(s, dict) and isinstance(s.get("size"), str):
            sizes.append(s["size"])
    full_name = name if not brand or name.lower().startswith(brand.lower()) else f"{brand} {name}"
    colour = None
    if isinstance(d.get("color"), dict):
        colour = d["color"].get("name")
    return RawListing(
        country=country.code, source="zalando_web", name=full_name, url=url, price=price.current, currency=country.currency,
        original_price=price.original, brand=brand, sku=sku, colour=colour,
        category_hint=SILHOUETTE_HINTS.get(str(d.get("silhouette") or "").upper()),
        gender_hint=GENDER_HINTS.get(str(d.get("navigationTargetGroup") or "").upper()),
        image_url=_media(d), sizes=list(dict.fromkeys(sizes)), sizes_known=bool(sizes), in_stock=True if sizes else None,
        extra={"prior_low_price": price.prior_low, "reference_label": price.reference_label, "price_varies": price.price_varies,
               "price_method": price.method, "sizes_source": "catalogue", "warnings": price.warnings},
    )


def parse_catalog_page(page: str, country: CountryConfig) -> tuple[list[RawListing], list[str]]:
    """Return (priced listings, all product links on the page)."""
    products = hydrated_products(extract_json_blobs(page))
    listings = [l for l in (listing_from_product(p, country) for p in products.values()) if l is not None]
    links = list(dict.fromkeys(urljoin(country.base_url, m.group("href")) for m in PRODUCT_LINK_RE.finditer(page)))
    return listings, links


def _ld_product_group(page: str, sku: str | None) -> dict | None:
    for blob in ld_json_blobs(page):
        for d in _walk(blob):
            if d.get("@type") == "ProductGroup" and (not sku or str(d.get("productGroupID", "")).upper() == sku):
                return d
    return None


def parse_detail_page(page: str, country: CountryConfig, url: str) -> RawListing | None:
    """Product page: hydration data for prices, ProductGroup JSON-LD for sizes, stock and shipping."""
    sku = extract_sku(url)
    products = hydrated_products(extract_json_blobs(page))
    base = products.get(sku) if sku else (next(iter(products.values())) if len(products) == 1 else None)
    listing = listing_from_product(base, country) if base else None
    group = _ld_product_group(page, sku)
    if group is None:
        if listing:
            listing.url = url
        return listing
    in_stock_sizes: list[str] = []
    prices: list[Decimal] = []
    seen_any = False
    currency = None
    for v in group.get("hasVariant") or []:
        if not isinstance(v, dict):
            continue
        offer = v.get("offers") if isinstance(v.get("offers"), dict) else {}
        size = v.get("size")
        avail = str(offer.get("availability", ""))
        p = offer.get("price")
        p = None if isinstance(p, (bool, dict, list)) else to_decimal(p)
        currency = offer.get("priceCurrency") or currency
        seen_any = True
        if "InStock" in avail or "LimitedAvailability" in avail:
            if isinstance(size, str):
                in_stock_sizes.append(size)
            if p is not None:
                prices.append(p)
    if currency and str(currency).upper() != country.currency:
        return listing
    shipping = None
    sd = group.get("shippingDetails")
    sd = sd[0] if isinstance(sd, list) and sd else sd
    if isinstance(sd, dict):
        rate = (sd.get("shippingRate") or {}).get("value")
        dest = ((sd.get("shippingDestination") or {}).get("addressCountry"))
        tt = ((sd.get("deliveryTime") or {}).get("transitTime") or {})
        cost = to_decimal(rate) if rate is not None else None
        shipping = {
            "cost": float(cost) if cost is not None else None, "currency": (sd.get("shippingRate") or {}).get("currency"),
            "destination": dest, "days_min": tt.get("minValue"), "days_max": tt.get("maxValue"), "name": sd.get("name"),
        }
    low = min(prices) if prices else None
    if listing is None:
        name = group.get("name")
        brand = (group.get("brand") or {}).get("name") if isinstance(group.get("brand"), dict) else None
        if not name or low is None:
            return None
        listing = RawListing(country=country.code, source="zalando_web",
                             name=name if not brand or name.startswith(brand) else f"{brand} {name}", url=url, price=low,
                             currency=country.currency, brand=brand, sku=sku or str(group.get("productGroupID", "")).upper() or None,
                             colour=group.get("color"), extra={"price_method": "json-ld"})
    else:
        listing.url = url
        if low is not None and listing.price is not None and low != listing.price:
            # sizes differ in price; the cheapest in-stock size is what can actually be bought
            if low < listing.price:
                listing.extra["price_varies"] = True
            listing.extra.setdefault("warnings", []).append(f"json-ld lowest in-stock {low} vs card {listing.price}")
            if listing.original_price is not None and low < listing.price:
                listing.price = low
    if seen_any:
        listing.sizes, listing.sizes_known, listing.in_stock = in_stock_sizes, True, bool(in_stock_sizes)
        listing.extra["sizes_source"] = "product-page"
    if shipping:
        listing.extra["shipping"] = shipping
    if not listing.image_url:
        img = group.get("image")
        if isinstance(img, list) and img and isinstance(img[0], str):
            listing.image_url = img[0]
        elif isinstance(img, str):
            listing.image_url = img
    if not listing.colour and isinstance(group.get("color"), str):
        listing.colour = group["color"].split("/")[0].strip() or None
    return listing


def merge_listing(primary: RawListing | None, detail: RawListing) -> RawListing:
    """Catalogue card + product page: verified page data wins; nothing is invented."""
    if primary is None:
        return detail
    extra = {**primary.extra, **{k: v for k, v in detail.extra.items() if v not in (None, [], {})}}
    original = detail.original_price if detail.original_price is not None else (primary.original_price if detail.price == primary.price else None)
    return RawListing(
        country=primary.country, source=primary.source, name=detail.name or primary.name, url=detail.url or primary.url,
        price=detail.price if detail.price is not None else primary.price, currency=primary.currency,
        original_price=original, brand=detail.brand or primary.brand, sku=primary.sku or detail.sku,
        colour=detail.colour or primary.colour, category_hint=primary.category_hint or detail.category_hint,
        gender_hint=primary.gender_hint or detail.gender_hint, image_url=primary.image_url or detail.image_url,
        sizes=detail.sizes if detail.sizes_known else primary.sizes, sizes_known=detail.sizes_known or primary.sizes_known,
        in_stock=detail.in_stock if detail.in_stock is not None else primary.in_stock, extra=extra,
    )


# ============================================================================ connector
@dataclass
class CrawlTask:
    url: str
    kind: str  # sale | franchise | popular
    pages: int  # max pages for this listing
    stop_when_undiscounted: bool = False


@dataclass
class CrawlPlan:
    brand_paths: tuple[str, ...] = ("/nike/", "/jordan/")
    sale_pages: int = 25
    popular_pages: int = 4
    franchise_pages: int = 1
    franchise_queries: list[tuple[str, str, int]] = field(default_factory=list)  # (slug, query, priority)
    detail_pages: int = 60
    include_priority_2_queries: bool = True


class ZalandoWebConnector(Connector):
    name = "zalando_web"

    def __init__(self, client: PoliteClient, plan: CrawlPlan | None = None) -> None:
        super().__init__()
        self.client = client
        self.plan = plan or CrawlPlan()

    # ---------------------------------------------------------------- urls
    @staticmethod
    def page_url(base: str, page: int) -> str:
        if page <= 1:
            return base
        return f"{base}{'&' if '?' in base else '?'}p={page}"

    def tasks(self, country: CountryConfig) -> list[CrawlTask]:
        p = self.plan
        out: list[CrawlTask] = []
        paths = list(dict.fromkeys([country.nike_path, *p.brand_paths]))
        for path in paths:
            out.append(CrawlTask(urljoin(country.base_url, path) + "?order=sale", "sale", p.sale_pages, stop_when_undiscounted=True))
        for slug, query, prio in p.franchise_queries:
            if prio > 1 and not p.include_priority_2_queries:
                continue
            path = "/jordan/" if ("jordan" in slug) else country.nike_path
            base = urljoin(country.base_url, path)
            out.append(CrawlTask(f"{base}?q={quote_plus(query)}&order=sale", "franchise", 1, stop_when_undiscounted=True))
            if prio == 1:
                out.append(CrawlTask(f"{base}?q={quote_plus(query)}", "franchise", p.franchise_pages))
        for path in paths:
            out.append(CrawlTask(urljoin(country.base_url, path), "popular", p.popular_pages))
        return out

    # ---------------------------------------------------------------- crawl
    def collect(self, country: CountryConfig) -> Iterator[RawListing]:
        found: dict[str, RawListing] = {}
        unpriced_links: list[str] = []
        start = self.client.requests_made
        blocked = False
        try:
            for task in self.tasks(country):
                if blocked:
                    break
                for page in range(1, task.pages + 1):
                    url = self.page_url(task.url, page)
                    try:
                        html = self.client.get_text(url)
                    except AccessBlocked as e:
                        self.stats.complete = False
                        if not found:
                            raise
                        self.stats.errors.append(f"blocked at {url}: {e}")
                        blocked = True
                        break
                    except ConnectorError as e:
                        self.stats.errors.append(str(e))
                        break
                    self.stats.pages += 1
                    listings, links = parse_catalog_page(html, country)
                    if not listings and not links:
                        break
                    new = 0
                    for l in listings:
                        if not is_nike(l.brand, l.name):
                            continue
                        if l.sku not in found:
                            new += 1
                        found[l.sku] = merge_listing(found.get(l.sku), l) if l.sku in found else l  # type: ignore[index]
                    for link in links:
                        s = extract_sku(link)
                        if s and s not in found and link not in unpriced_links:
                            unpriced_links.append(link)
                    if task.stop_when_undiscounted and listings and all(l.original_price is None for l in listings):
                        break  # sale-sorted list has reached undiscounted products
                    if new == 0 and page > 1:
                        break
            if not blocked:
                self._details(country, found, unpriced_links)
        finally:
            self.stats.requests = self.client.requests_made - start
        yield from found.values()

    def _details(self, country: CountryConfig, found: dict[str, RawListing], unpriced: list[str]) -> None:
        """Product pages for priority products (verified sizes, stock, shipping)."""
        from ..catalog.classifier import match_franchise

        def prio(l: RawListing) -> tuple:
            f = match_franchise(l.name)
            return (f.priority if f else 9, -(float(l.original_price or 0) - float(l.price or 0)))

        candidates = sorted((l for l in found.values() if match_franchise(l.name)), key=prio)
        queue = [l.url for l in candidates][: self.plan.detail_pages]
        for url in queue:
            try:
                html = self.client.get_text(url)
            except AccessBlocked as e:
                self.stats.complete = False
                self.stats.errors.append(f"blocked on product pages: {e}")
                return
            except ConnectorError as e:
                self.stats.errors.append(str(e))
                continue
            detail = parse_detail_page(html, country, url)
            if detail is None:
                self.stats.rejected += 1
                continue
            key = detail.sku or extract_sku(url)
            if key and key in found:
                found[key] = merge_listing(found[key], detail)
        self.stats.extra_unpriced = len([u for u in unpriced if extract_sku(u) not in found])  # type: ignore[attr-defined]


def sku_from_url(url: str) -> str | None:
    m = URL_SKU_RE.search(url)
    return f"{m.group(1)}-{m.group(2)}".upper() if m else None
