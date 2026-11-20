"""Authorised product-feed connector (recommended for cloud deployments).

Zalando runs affiliate programmes (e.g. on Awin) that publish complete product feeds
per country, including the selling price, the recommended/original price, sizes, stock
and deep links. Using a feed is the terms-compliant way to monitor prices from a server.

Configure one feed URL per country (``FEED_URL_NL`` ... ``FEED_URL_PL``). Awin's
"Create-a-Feed" download URLs work as-is (CSV, optionally gzip-compressed). Other
networks work with ``FEED_FORMAT=generic`` and the column names below.
"""
from __future__ import annotations

import csv
import gzip
import io
import logging
import zipfile
from collections.abc import Iterator

from ..catalog.classifier import extract_sku, is_nike
from ..pricing import detect_currency, parse_price, to_decimal
from .base import Connector, ConnectorNotConfigured, CountryConfig, RawListing
from .http import PoliteClient

log = logging.getLogger(__name__)

# preset -> field -> candidate column names (first non-empty wins)
COLUMN_PRESETS: dict[str, dict[str, tuple[str, ...]]] = {
    "awin": {
        "id": ("merchant_product_id", "aw_product_id", "product_id"),
        "parent_id": ("parent_product_id", "item_group_id", "merchant_product_id"),
        "name": ("product_name",),
        "brand": ("brand_name", "brand"),
        "price": ("search_price", "store_price", "display_price"),
        "original_price": ("rrp_price", "product_price_old", "base_price"),
        "currency": ("currency",),
        "url": ("merchant_deep_link", "aw_deep_link"),
        "affiliate_url": ("aw_deep_link",),
        "image": ("merchant_image_url", "large_image", "aw_image_url"),
        "colour": ("colour", "Fashion:colour", "color"),
        "category": ("merchant_category", "category_name", "merchant_product_category_path", "product_type"),
        "gender": ("Fashion:suitable_for", "suitable_for", "gender", "custom_1"),
        "size": ("Fashion:size", "size"),
        "in_stock": ("in_stock", "stock_status", "is_for_sale"),
        "stock_quantity": ("stock_quantity",),
        "delivery": ("delivery_cost", "delivery_time"),
    },
    "generic": {
        "id": ("id", "sku"), "parent_id": ("parent_id", "item_group_id", "sku"), "name": ("name", "title"),
        "brand": ("brand",), "price": ("price", "sale_price"), "original_price": ("original_price", "list_price", "rrp"),
        "currency": ("currency",), "url": ("url", "link"), "affiliate_url": ("affiliate_url",), "image": ("image", "image_link"),
        "colour": ("colour", "color"), "category": ("category", "product_type"), "gender": ("gender",),
        "size": ("size",), "in_stock": ("in_stock", "availability"), "stock_quantity": ("stock_quantity",), "delivery": ("shipping",),
    },
}

_TRUE = {"1", "true", "yes", "y", "in stock", "instock", "in_stock", "available"}


def _get(row: dict, cols: tuple[str, ...]) -> str | None:
    for c in cols:
        v = row.get(c)
        if v not in (None, ""):
            return str(v).strip()
    return None


def decode_feed(raw: bytes) -> str:
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    elif raw[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            raw = z.read(z.namelist()[0])
    return raw.decode("utf-8-sig", errors="replace")


def parse_feed(text: str, country: CountryConfig, preset: str = "awin") -> tuple[list[RawListing], int]:
    cols = COLUMN_PRESETS[preset]
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    grouped: dict[str, dict] = {}
    rejected = 0
    for row in reader:
        name = _get(row, cols["name"])
        brand = _get(row, cols["brand"])
        if not name or not is_nike(brand, name):
            continue
        url = _get(row, cols["url"]) or ""
        sku = extract_sku(url, _get(row, cols["parent_id"]), _get(row, cols["id"]))
        price_raw = _get(row, cols["price"])
        price = to_decimal(price_raw) if price_raw and price_raw.replace(".", "", 1).isdigit() else parse_price(price_raw)
        if price is None or sku is None:
            rejected += 1
            continue
        orig_raw = _get(row, cols["original_price"])
        original = (to_decimal(orig_raw) if orig_raw and orig_raw.replace(".", "", 1).isdigit() else parse_price(orig_raw)) if orig_raw else None
        if original is not None and original <= 0:
            original = None
        currency = (_get(row, cols["currency"]) or detect_currency(price_raw, country.currency)).upper()
        stock_raw = (_get(row, cols["in_stock"]) or "").lower()
        qty = _get(row, cols["stock_quantity"])
        in_stock = (stock_raw in _TRUE) if stock_raw else (int(float(qty)) > 0 if qty and qty.replace(".", "", 1).isdigit() else None)
        size = _get(row, cols["size"])
        g = grouped.setdefault(sku, {
            "name": name, "brand": brand, "url": url, "currency": currency, "image": _get(row, cols["image"]),
            "colour": _get(row, cols["colour"]), "category": _get(row, cols["category"]), "gender": _get(row, cols["gender"]),
            "prices": [], "originals": [], "sizes": [], "stock": [], "delivery": _get(row, cols["delivery"]),
            "affiliate_url": _get(row, cols["affiliate_url"]),
        })
        if in_stock is not False:
            g["prices"].append(price)
            if original is not None:
                g["originals"].append((price, original))
        if size:
            for s in size.replace("|", ",").split(","):
                s = s.strip()
                if s and in_stock is not False:
                    g["sizes"].append(s)
        g["stock"].append(in_stock)
    out: list[RawListing] = []
    for sku, g in grouped.items():
        known_stock = [s for s in g["stock"] if s is not None]
        in_stock = any(known_stock) if known_stock else None
        if not g["prices"]:
            # every size is sold out: we know it's listed but have no purchasable price
            continue
        price = min(g["prices"])
        # the original price that belongs to the cheapest size
        originals = [o for p, o in g["originals"] if p == price]
        out.append(RawListing(
            country=country.code, source="feed", name=g["name"], url=g["url"], price=price, currency=g["currency"],
            original_price=max(originals) if originals else None, brand=g["brand"], sku=sku, colour=g["colour"],
            category_hint=g["category"], gender_hint=g["gender"], image_url=g["image"],
            sizes=list(dict.fromkeys(g["sizes"])), sizes_known=bool(g["sizes"]), in_stock=in_stock,
            extra={"delivery": g["delivery"], "affiliate_url": g["affiliate_url"]},
        ))
    return out, rejected


class FeedConnector(Connector):
    name = "feed"

    def __init__(self, client: PoliteClient, feed_url: str, preset: str = "awin") -> None:
        super().__init__()
        self.client = client
        self.feed_url = feed_url
        self.preset = preset if preset in COLUMN_PRESETS else "awin"

    def collect(self, country: CountryConfig) -> Iterator[RawListing]:
        if not self.feed_url:
            raise ConnectorNotConfigured(f"no feed URL configured for {country.code} (set FEED_URL_{country.code})")
        before = self.client.requests_made
        raw = self.client.get_bytes(self.feed_url)
        self.stats.requests = self.client.requests_made - before
        listings, rejected = parse_feed(decode_feed(raw), country, self.preset)
        self.stats.rejected = rejected
        self.stats.pages = 1
        yield from listings
