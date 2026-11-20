from __future__ import annotations

from ..catalog.franchises import FRANCHISES, FranchiseDef
from ..config import Settings
from .base import Connector, ConnectorNotConfigured, CountryConfig
from .feed import FeedConnector
from .http import PoliteClient
from .sample import SampleConnector
from .zalando_web import CrawlPlan, ZalandoWebConnector

COUNTRY_SEED = [
    # code, name, domain, currency, language, nike path
    ("NL", "Netherlands", "www.zalando.nl", "EUR", "nl-NL", "/nike/"),
    ("DE", "Germany", "www.zalando.de", "EUR", "de-DE", "/nike/"),
    ("FR", "France", "www.zalando.fr", "EUR", "fr-FR", "/nike/"),
    ("ES", "Spain", "www.zalando.es", "EUR", "es-ES", "/nike/"),
    ("PL", "Poland", "www.zalando.pl", "PLN", "pl-PL", "/nike/"),
]
SHIPPING_NOTE = (
    "Zalando country shops generally deliver only to addresses in that country. "
    "Shipping costs and delivery restrictions are not verified by the tracker; check at checkout."
)
AVAILABLE_CONNECTORS = ("zalando_web", "feed", "sample", "disabled")


def make_client(settings: Settings, language: str = "en") -> PoliteClient:
    return PoliteClient(
        user_agent=settings.http_user_agent,
        min_delay=settings.http_min_delay_seconds,
        timeout=settings.http_timeout_seconds,
        max_retries=settings.http_max_retries,
        cache_dir=settings.http_cache_dir,
        cache_ttl_hours=settings.http_cache_ttl_hours,
        accept_language=f"{language},{language.split('-')[0]};q=0.9,en;q=0.5",
    )


def crawl_plan(settings: Settings, franchises: list[FranchiseDef] | None = None) -> CrawlPlan:
    defs = franchises if franchises is not None else FRANCHISES
    queries = [(f.slug, f.search_query, f.priority) for f in defs if f.search_query]
    return CrawlPlan(
        brand_paths=tuple(p.strip() for p in settings.zalando_brand_paths.split(",") if p.strip()),
        sale_pages=settings.zalando_sale_pages, popular_pages=settings.zalando_popular_pages,
        franchise_pages=settings.zalando_franchise_pages, franchise_queries=queries,  # type: ignore[arg-type]
        detail_pages=settings.max_detail_pages_per_country,
        include_priority_2_queries=settings.zalando_include_priority2_searches,
    )


def build_connector(name: str, country: CountryConfig, settings: Settings, franchises: list[FranchiseDef] | None = None) -> Connector:
    if name == "zalando_web":
        return ZalandoWebConnector(make_client(settings, country.language), crawl_plan(settings, franchises))
    if name == "feed":
        return FeedConnector(make_client(settings, country.language), settings.feed_url_for(country.code), settings.feed_format)
    if name == "sample":
        return SampleConnector()
    raise ConnectorNotConfigured(f"connector '{name}' is disabled or unknown for {country.code}")
