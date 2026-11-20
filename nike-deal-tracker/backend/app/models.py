"""Database schema.

Identity model
--------------
* ``Product``        one Nike article in one colourway, identified by the Zalando *config SKU*
                     (e.g. ``NI112O0BV-A11``). The same config SKU is used on every Zalando
                     country shop, which is what makes cross-country comparison exact.
* ``ProductVariant`` the listing of a product in one country (local name, URL, currency).
* ``CurrentPrice``   latest *valid* observation per variant (fast reads for the dashboard).
* ``PriceHistory``   append-only, timestamped observations. Never updated, never deleted
                     by scans.
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


Money = Numeric(12, 2)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    settings: Mapped[UserSettings | None] = relationship(back_populates="user", uselist=False)


class UserSettings(Base):
    __tablename__ = "user_settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    report_email: Mapped[str | None] = mapped_column(String(320))
    report_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    schedule_weekday: Mapped[int] = mapped_column(Integer, default=0)  # 0 = Monday
    schedule_hour: Mapped[int] = mapped_column(Integer, default=8)
    schedule_minute: Mapped[int] = mapped_column(Integer, default=0)
    timezone: Mapped[str] = mapped_column(String(64), default="Europe/Amsterdam")
    report_min_discount: Mapped[int] = mapped_column(Integer, default=20)
    flag_discount: Mapped[int] = mapped_column(Integer, default=30)
    notify_on_failure: Mapped[bool] = mapped_column(Boolean, default=True)
    theme: Mapped[str] = mapped_column(String(10), default="dark")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    user: Mapped[User] = relationship(back_populates="settings")


class Country(Base):
    __tablename__ = "countries"
    code: Mapped[str] = mapped_column(String(2), primary_key=True)  # NL, DE, FR, ES, PL
    name: Mapped[str] = mapped_column(String(64))
    domain: Mapped[str] = mapped_column(String(64))
    currency: Mapped[str] = mapped_column(String(3))
    language: Mapped[str] = mapped_column(String(5))
    nike_path: Mapped[str] = mapped_column(String(128))  # brand catalogue path on that shop
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    connector: Mapped[str | None] = mapped_column(String(32))  # overrides env when set
    shipping_note: Mapped[str | None] = mapped_column(Text)


class Franchise(Base):
    __tablename__ = "franchises"
    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(128))
    group: Mapped[str] = mapped_column(String(32), index=True)  # air-force-1, air-max, running, ...
    priority: Mapped[int] = mapped_column(Integer, default=2)  # 1 core, 2 major, 3 apparel/other
    patterns: Mapped[list] = mapped_column(JSON, default=list)  # regexes on normalised names
    specificity: Mapped[int] = mapped_column(Integer, default=0)  # higher wins on ties
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False)


class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(primary_key=True)
    match_key: Mapped[str] = mapped_column(String(64), unique=True, index=True)  # config SKU or derived
    sku: Mapped[str | None] = mapped_column(String(32), index=True)
    brand: Mapped[str] = mapped_column(String(64), default="Nike")
    franchise_id: Mapped[int | None] = mapped_column(ForeignKey("franchises.id"), index=True)
    model: Mapped[str | None] = mapped_column(String(200))
    name: Mapped[str] = mapped_column(String(300))
    colourway: Mapped[str | None] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(32), default="other", index=True)
    subcategory: Mapped[str | None] = mapped_column(String(64))
    gender: Mapped[str] = mapped_column(String(16), default="unisex", index=True)
    image_url: Mapped[str | None] = mapped_column(Text)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    franchise: Mapped[Franchise | None] = relationship()
    variants: Mapped[list[ProductVariant]] = relationship(back_populates="product", cascade="all, delete-orphan")


class ProductVariant(Base):
    """A product as listed in one country's shop."""

    __tablename__ = "product_variants"
    __table_args__ = (UniqueConstraint("product_id", "country_code", name="uq_variant_product_country"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    country_code: Mapped[str] = mapped_column(ForeignKey("countries.code"), index=True)
    local_name: Mapped[str] = mapped_column(String(300))
    url: Mapped[str] = mapped_column(Text)
    currency: Mapped[str] = mapped_column(String(3))
    source: Mapped[str] = mapped_column(String(32))  # connector that produced it
    listed: Mapped[bool] = mapped_column(Boolean, default=True)  # still present in last good scan
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    discounted_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    shipping: Mapped[dict | None] = mapped_column(JSON)  # verified from the product page, when available

    product: Mapped[Product] = relationship(back_populates="variants")
    current: Mapped[CurrentPrice | None] = relationship(back_populates="variant", uselist=False, cascade="all, delete-orphan")


class CurrentPrice(Base):
    __tablename__ = "current_prices"
    variant_id: Mapped[int] = mapped_column(ForeignKey("product_variants.id", ondelete="CASCADE"), primary_key=True)
    currency: Mapped[str] = mapped_column(String(3))
    price: Mapped[Decimal] = mapped_column(Money)
    original_price: Mapped[Decimal | None] = mapped_column(Money)
    price_eur: Mapped[Decimal] = mapped_column(Money, index=True)
    original_price_eur: Mapped[Decimal | None] = mapped_column(Money)
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0, index=True)
    discount_amount_eur: Mapped[Decimal] = mapped_column(Money, default=0)
    in_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    sizes: Mapped[list] = mapped_column(JSON, default=list)  # available sizes
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    scan_id: Mapped[int | None] = mapped_column(ForeignKey("scan_sessions.id", ondelete="SET NULL"))
    previous_price_eur: Mapped[Decimal | None] = mapped_column(Money)  # price at previous valid scan
    # EU price-indication rules: Zalando may also show the lowest price of the previous 30 days
    prior_low_price: Mapped[Decimal | None] = mapped_column(Money)
    prior_low_price_eur: Mapped[Decimal | None] = mapped_column(Money)
    reference_label: Mapped[str | None] = mapped_column(String(200))  # the shop's label for the original price
    price_varies: Mapped[bool] = mapped_column(Boolean, default=False)  # "from" price: differs per size
    variant: Mapped[ProductVariant] = relationship(back_populates="current")


class PriceHistory(Base):
    __tablename__ = "price_history"
    __table_args__ = (
        Index("ix_history_variant_time", "variant_id", "observed_at"),
        UniqueConstraint("variant_id", "scan_id", name="uq_history_variant_scan"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    variant_id: Mapped[int] = mapped_column(ForeignKey("product_variants.id", ondelete="CASCADE"))
    scan_id: Mapped[int | None] = mapped_column(ForeignKey("scan_sessions.id", ondelete="SET NULL"))
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    currency: Mapped[str] = mapped_column(String(3))
    price: Mapped[Decimal] = mapped_column(Money)
    original_price: Mapped[Decimal | None] = mapped_column(Money)
    price_eur: Mapped[Decimal] = mapped_column(Money)
    original_price_eur: Mapped[Decimal | None] = mapped_column(Money)
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    in_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    size_count: Mapped[int] = mapped_column(Integer, default=0)
    fx_rate: Mapped[Decimal | None] = mapped_column(Numeric(14, 6))
    prior_low_price: Mapped[Decimal | None] = mapped_column(Money)
    source: Mapped[str] = mapped_column(String(32))


class ProductAvailability(Base):
    __tablename__ = "product_availability"
    __table_args__ = (UniqueConstraint("variant_id", "size", name="uq_avail_variant_size"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    variant_id: Mapped[int] = mapped_column(ForeignKey("product_variants.id", ondelete="CASCADE"), index=True)
    size: Mapped[str] = mapped_column(String(32))
    in_stock: Mapped[bool] = mapped_column(Boolean, default=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ScanSession(Base):
    __tablename__ = "scan_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    trigger: Mapped[str] = mapped_column(String(16))  # schedule | manual | cli
    status: Mapped[str] = mapped_column(String(16), default="running")  # running|success|partial|failed
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    week_key: Mapped[str | None] = mapped_column(String(10), index=True)  # 2026-W47 for scheduled runs
    products_found: Mapped[int] = mapped_column(Integer, default=0)
    products_updated: Mapped[int] = mapped_column(Integer, default=0)
    new_products: Mapped[int] = mapped_column(Integer, default=0)
    new_discounts: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    results: Mapped[list[ScanResult]] = relationship(back_populates="scan", cascade="all, delete-orphan")


class ScanResult(Base):
    """Per-country outcome of a scan."""

    __tablename__ = "scan_results"
    id: Mapped[int] = mapped_column(primary_key=True)
    scan_id: Mapped[int] = mapped_column(ForeignKey("scan_sessions.id", ondelete="CASCADE"), index=True)
    country_code: Mapped[str] = mapped_column(String(2))
    connector: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(16), default="running")  # success|partial|failed|blocked|skipped
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    requests_made: Mapped[int] = mapped_column(Integer, default=0)
    products_found: Mapped[int] = mapped_column(Integer, default=0)
    products_updated: Mapped[int] = mapped_column(Integer, default=0)
    new_products: Mapped[int] = mapped_column(Integer, default=0)
    new_discounts: Mapped[int] = mapped_column(Integer, default=0)
    rejected_records: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[list] = mapped_column(JSON, default=list)
    scan: Mapped[ScanSession] = relationship(back_populates="results")


class DealEvent(Base):
    """Things worth reporting that happened during a scan."""

    __tablename__ = "deal_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    scan_id: Mapped[int] = mapped_column(ForeignKey("scan_sessions.id", ondelete="CASCADE"), index=True)
    variant_id: Mapped[int] = mapped_column(ForeignKey("product_variants.id", ondelete="CASCADE"), index=True)
    # new_product | new_discount | price_drop | back_in_stock | all_time_low | deeper_discount
    kind: Mapped[str] = mapped_column(String(24), index=True)
    old_value: Mapped[Decimal | None] = mapped_column(Money)
    new_value: Mapped[Decimal | None] = mapped_column(Money)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Watchlist(Base):
    __tablename__ = "watchlists"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100), default="My watchlist")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    rules: Mapped[list[WatchlistRule]] = relationship(back_populates="watchlist", cascade="all, delete-orphan")


class WatchlistRule(Base):
    __tablename__ = "watchlist_rules"
    id: Mapped[int] = mapped_column(primary_key=True)
    watchlist_id: Mapped[int] = mapped_column(ForeignKey("watchlists.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(16))  # product | franchise | colourway
    label: Mapped[str | None] = mapped_column(String(200))
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    franchise_id: Mapped[int | None] = mapped_column(ForeignKey("franchises.id", ondelete="CASCADE"))
    colourway: Mapped[str | None] = mapped_column(String(200))  # substring match, case-insensitive
    size: Mapped[str | None] = mapped_column(String(32))
    country_code: Mapped[str | None] = mapped_column(String(2))
    min_discount: Mapped[int | None] = mapped_column(Integer)
    max_price_eur: Mapped[Decimal | None] = mapped_column(Money)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    watchlist: Mapped[Watchlist] = relationship(back_populates="rules")


class EmailReport(Base):
    __tablename__ = "email_reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    scan_id: Mapped[int | None] = mapped_column(ForeignKey("scan_sessions.id", ondelete="SET NULL"), index=True)
    kind: Mapped[str] = mapped_column(String(16), default="weekly")  # weekly | failure | test
    recipient: Mapped[str] = mapped_column(String(320))
    subject: Mapped[str] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending|sent|failed|skipped
    provider: Mapped[str] = mapped_column(String(16))
    provider_message_id: Mapped[str | None] = mapped_column(String(200))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text)
    html: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ExchangeRate(Base):
    __tablename__ = "exchange_rates"
    __table_args__ = (UniqueConstraint("rate_date", "base", "quote", name="uq_fx_date_pair"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    rate_date: Mapped[date] = mapped_column(Date, index=True)
    base: Mapped[str] = mapped_column(String(3))  # EUR
    quote: Mapped[str] = mapped_column(String(3))  # PLN
    rate: Mapped[Decimal] = mapped_column(Numeric(14, 6))  # 1 base = rate quote
    source: Mapped[str] = mapped_column(String(32), default="ecb")
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
