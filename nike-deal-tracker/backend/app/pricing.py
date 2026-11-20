"""Price parsing and discount maths. All money is ``Decimal``; nothing is ever estimated."""
from __future__ import annotations

import re
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

CENT = Decimal("0.01")

DISCOUNT_BANDS: list[tuple[int, str, str]] = [
    # (lower bound %, key, label)
    (50, "exceptional", "Exceptional deal"),
    (40, "excellent", "Excellent deal"),
    (30, "strong", "Strong deal"),
    (20, "good", "Good deal"),
    (10, "small", "Small discount"),
    (0, "none", "No significant discount"),
]

FLAG_THRESHOLD = 30

_CURRENCY_SIGNS = {"€": "EUR", "eur": "EUR", "zł": "PLN", "zl": "PLN", "pln": "PLN"}


def to_decimal(value) -> Decimal | None:
    if value is None or value == "":
        return None
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float)):
        if isinstance(value, float) and value != value:  # NaN
            return None
        return Decimal(str(value))
    return parse_price(str(value))


def parse_price(text: str | None) -> Decimal | None:
    """Parse a localised price string.

    >>> parse_price("€ 119,99"), parse_price("119,95 €"), parse_price("1.299,00 zł")
    (Decimal('119.99'), Decimal('119.95'), Decimal('1299.00'))
    >>> parse_price("1 299,99 zł"), parse_price("EUR 89.95"), parse_price("12999")  # minor units not assumed
    (Decimal('1299.99'), Decimal('89.95'), Decimal('12999'))
    """
    if text is None:
        return None
    s = str(text).strip().lower()
    for sign in ("€", "eur", "zł", "zl", "pln", " ", " "):
        s = s.replace(sign, " ")
    s = re.sub(r"(?<=\d)[ '](?=\d{3}\b)", "", s.strip())  # 1 299,99 -> 1299,99
    m = re.search(r"-?\d[\d.,]*", s)
    if not m:
        return None
    num = m.group(0).rstrip(".,")
    if "," in num and "." in num:
        # the last separator is the decimal separator
        if num.rfind(",") > num.rfind("."):
            num = num.replace(".", "").replace(",", ".")
        else:
            num = num.replace(",", "")
    elif "," in num:
        head, _, tail = num.rpartition(",")
        # "1,299" -> thousands (shop prices always carry 2 decimals); "89,95" -> decimals
        num = head.replace(",", "") + tail if len(tail) == 3 else head.replace(",", "") + "." + tail
    elif "." in num:
        head, _, tail = num.rpartition(".")
        if len(tail) == 3:  # 1.299 (thousands) ; prices like 1.299 never have 3 decimals
            num = head.replace(".", "") + tail
        else:
            num = head.replace(".", "") + "." + tail
    try:
        d = Decimal(num)
    except InvalidOperation:
        return None
    return d if d >= 0 else None


def detect_currency(text: str | None, default: str) -> str:
    if not text:
        return default
    low = text.lower()
    for sign, cur in _CURRENCY_SIGNS.items():
        if sign in low:
            return cur
    return default


def money(d: Decimal | None) -> Decimal | None:
    return None if d is None else d.quantize(CENT, rounding=ROUND_HALF_UP)


def discount_pct(original: Decimal | None, current: Decimal | None) -> Decimal:
    """((original - current) / original) * 100, rounded to 2 decimals. 0 when unknown/no discount."""
    if original is None or current is None or original <= 0 or current >= original:
        return Decimal("0.00")
    return ((original - current) / original * 100).quantize(CENT, rounding=ROUND_HALF_UP)


def discount_amount(original: Decimal | None, current: Decimal | None) -> Decimal:
    if original is None or current is None or current >= original:
        return Decimal("0.00")
    return money(original - current)  # type: ignore[return-value]


def discount_band(pct: Decimal | float | int) -> dict:
    p = float(pct)
    for lower, key, label in DISCOUNT_BANDS:
        if p >= lower:
            return {"key": key, "label": label, "flagged": p >= FLAG_THRESHOLD}
    return {"key": "none", "label": "No significant discount", "flagged": False}


def validate_prices(price: Decimal | None, original: Decimal | None) -> tuple[bool, str | None]:
    """Sanity checks so a broken page can never pollute history."""
    if price is None:
        return False, "missing price"
    if price <= 0:
        return False, "non-positive price"
    if price > Decimal("10000"):
        return False, "implausibly high price"
    if original is not None:
        if original <= 0:
            return False, "non-positive original price"
        if original < price:
            # shops sometimes show a 'was' price lower than current: treat as no discount
            return True, "original below current (ignored)"
        if price / original < Decimal("0.05"):
            return False, "discount above 95% (likely parse error)"
    return True, None
