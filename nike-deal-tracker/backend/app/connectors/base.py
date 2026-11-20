from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterator
from dataclasses import dataclass, field
from decimal import Decimal


class ConnectorError(RuntimeError):
    """A recoverable problem with one page/record."""


class AccessBlocked(ConnectorError):
    """The site refused access (403, bot challenge, robots.txt). Never retried or circumvented."""


class ConnectorNotConfigured(ConnectorError):
    pass


@dataclass
class CountryConfig:
    code: str  # NL
    domain: str  # www.zalando.nl
    currency: str  # EUR / PLN
    language: str  # nl-NL
    nike_path: str = "/nike/"
    shipping_note: str | None = None

    @property
    def base_url(self) -> str:
        return f"https://{self.domain}"


@dataclass
class RawListing:
    """One product as observed in one country. Prices are exactly what the source showed."""

    country: str
    source: str
    name: str
    url: str
    price: Decimal | None
    currency: str
    original_price: Decimal | None = None
    brand: str | None = "Nike"
    sku: str | None = None
    colour: str | None = None
    category_hint: str | None = None
    gender_hint: str | None = None
    image_url: str | None = None
    sizes: list[str] = field(default_factory=list)
    sizes_known: bool = False  # False: we did not observe sizes, keep previous size data
    in_stock: bool | None = None
    is_sample: bool = False
    extra: dict = field(default_factory=dict)


@dataclass
class CollectStats:
    requests: int = 0
    pages: int = 0
    rejected: int = 0
    errors: list[str] = field(default_factory=list)
    complete: bool = True  # False when we stopped early (budget, block) -> don't infer "delisted"


class Connector(ABC):
    name: str = "base"

    def __init__(self) -> None:
        self.stats = CollectStats()

    @abstractmethod
    def collect(self, country: CountryConfig) -> Iterator[RawListing]:
        ...

    def close(self) -> None:  # pragma: no cover
        pass
