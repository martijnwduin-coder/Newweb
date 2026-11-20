from __future__ import annotations

import os
from collections.abc import Callable, Iterator
from decimal import Decimal
from pathlib import Path

import pytest

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def _env(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path}/test.db")
    monkeypatch.setenv("HTTP_CACHE_DIR", str(tmp_path / "cache"))
    monkeypatch.setenv("ADMIN_EMAIL", "me@example.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "correct-horse-battery")
    monkeypatch.setenv("JWT_SECRET", "x" * 40)
    monkeypatch.setenv("CRON_TOKEN", "cron-secret")
    monkeypatch.setenv("EMAIL_PROVIDER", "none")
    monkeypatch.setenv("REPORT_RECIPIENT", "me@example.com")
    from app import config, db

    from app.auth import api_limiter, login_limiter

    config.get_settings.cache_clear()
    db.reset_engine()
    login_limiter.reset()
    api_limiter.reset()
    yield
    db.reset_engine()
    config.get_settings.cache_clear()


@pytest.fixture
def session():
    from app.db import SessionLocal, init_db
    from app.seed import bootstrap

    init_db()
    s = SessionLocal()
    bootstrap(s)
    yield s
    s.close()


def fixture_text(name: str) -> str:
    return (FIXTURES / name).read_text()


@pytest.fixture
def fx():
    from app.fx import FxConverter

    return FxConverter({"PLN": Decimal("4.25")})


def make_listing(country="NL", sku="NI112N022-A11", price="95.95", original="119.95", name=None, **kw):
    from app.connectors.base import RawListing

    currency = kw.pop("currency", "PLN" if country == "PL" else "EUR")
    return RawListing(
        country=country, source="test", name=name or "Nike Sportswear AIR FORCE 1 07 - Sneakers laag - white",
        url=f"https://www.zalando.{country.lower()}/x-{sku.lower()}.html", price=Decimal(price),
        original_price=Decimal(original) if original else None, currency=currency, brand="Nike Sportswear", sku=sku,
        sizes=kw.pop("sizes", ["42", "43"]), sizes_known=kw.pop("sizes_known", True), in_stock=kw.pop("in_stock", True), **kw,
    )


class FakeConnector:
    """Connector returning prepared listings, or raising, per country."""

    name = "fake"

    def __init__(self, by_country: dict, complete: bool = True):
        from app.connectors.base import CollectStats

        self.by_country = by_country
        self.stats = CollectStats(complete=complete)

    def collect(self, country) -> Iterator:
        v = self.by_country.get(country.code, [])
        if isinstance(v, Exception):
            raise v
        yield from v

    def close(self):
        pass


def factory_for(by_country: dict, complete: bool = True) -> Callable:
    return lambda name, cfg, settings: FakeConnector(by_country, complete)
