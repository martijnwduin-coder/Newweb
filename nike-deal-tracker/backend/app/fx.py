"""Exchange rates from the European Central Bank reference feed (free, no key)."""
from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import ExchangeRate
from .pricing import money

log = logging.getLogger(__name__)
ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
MAX_RATE_AGE_DAYS = 7


class FxUnavailable(RuntimeError):
    pass


def parse_ecb_xml(xml: str) -> tuple[date, dict[str, Decimal]]:
    m = re.search(r"time=['\"](\d{4}-\d{2}-\d{2})['\"]", xml)
    if not m:
        raise ValueError("ECB feed: no date")
    rates = {cur: Decimal(rate) for cur, rate in re.findall(r"currency=['\"]([A-Z]{3})['\"]\s+rate=['\"]([\d.]+)['\"]", xml)}
    if not rates:
        raise ValueError("ECB feed: no rates")
    return date.fromisoformat(m.group(1)), rates


def refresh_rates(db: Session, client: httpx.Client | None = None, quotes: tuple[str, ...] = ("PLN",)) -> list[ExchangeRate]:
    own = client is None
    client = client or httpx.Client(timeout=20)
    try:
        r = client.get(ECB_URL)
        r.raise_for_status()
        d, rates = parse_ecb_xml(r.text)
    finally:
        if own:
            client.close()
    out = []
    for q in quotes:
        if q not in rates:
            continue
        existing = db.scalar(select(ExchangeRate).where(ExchangeRate.rate_date == d, ExchangeRate.base == "EUR", ExchangeRate.quote == q))
        if existing is None:
            existing = ExchangeRate(rate_date=d, base="EUR", quote=q, rate=rates[q], source="ecb")
            db.add(existing)
        out.append(existing)
    db.flush()
    return out


def latest_rate(db: Session, quote: str) -> ExchangeRate | None:
    return db.scalar(
        select(ExchangeRate).where(ExchangeRate.base == "EUR", ExchangeRate.quote == quote).order_by(ExchangeRate.rate_date.desc()).limit(1)
    )


class FxConverter:
    """Converts local prices to EUR using one rate per scan, so a scan is internally consistent."""

    def __init__(self, rates: dict[str, Decimal]):
        self.rates = {"EUR": Decimal("1"), **rates}  # 1 EUR = rate * CUR

    @classmethod
    def for_scan(cls, db: Session, quotes: tuple[str, ...] = ("PLN",), *, try_refresh: bool = True) -> FxConverter:
        if try_refresh:
            try:
                refresh_rates(db, quotes=quotes)
            except Exception as e:  # network down: fall back to stored rate
                log.warning("fx refresh failed: %s", e)
        rates: dict[str, Decimal] = {}
        for q in quotes:
            r = latest_rate(db, q)
            if r and (datetime.now(timezone.utc).date() - r.rate_date) <= timedelta(days=MAX_RATE_AGE_DAYS):
                rates[q] = Decimal(r.rate)
        return cls(rates)

    def has(self, currency: str) -> bool:
        return currency in self.rates

    def rate(self, currency: str) -> Decimal:
        if currency not in self.rates:
            raise FxUnavailable(f"no recent EUR/{currency} rate")
        return self.rates[currency]

    def to_eur(self, amount: Decimal | None, currency: str) -> Decimal | None:
        if amount is None:
            return None
        return money(amount / self.rate(currency))
