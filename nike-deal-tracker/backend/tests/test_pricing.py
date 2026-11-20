from decimal import Decimal as D

import pytest

from app.pricing import discount_amount, discount_band, discount_pct, parse_price, validate_prices


@pytest.mark.parametrize("text,expected", [
    ("€ 119,99", "119.99"), ("119,95 €", "119.95"), ("€ 71,95", "71.95"), ("1.299,00 zł", "1299.00"),
    ("1 299,99 zł", "1299.99"), ("75,00 zł", "75.00"), ("EUR 89.95", "89.95"), ("89.95", "89.95"),
    ("1,299.50", "1299.50"), ("€ 6,00", "6.00"), ("249 zł", "249"),
])
def test_parse_price(text, expected):
    assert parse_price(text) == D(expected)


@pytest.mark.parametrize("text", [None, "", "gratis", "-", "Vanaf"])
def test_parse_price_none(text):
    assert parse_price(text) is None


def test_discount_formula():
    # ((original - current) / original) * 100
    assert discount_pct(D("129.95"), D("71.95")) == D("44.63")
    assert discount_pct(D("100"), D("70")) == D("30.00")
    assert discount_amount(D("129.95"), D("71.95")) == D("58.00")


def test_no_discount_cases():
    assert discount_pct(None, D("50")) == 0
    assert discount_pct(D("50"), D("50")) == 0
    assert discount_pct(D("40"), D("50")) == 0  # 'was' lower than now is not a discount
    assert discount_amount(D("40"), D("50")) == 0


@pytest.mark.parametrize("pct,key,flagged", [
    (0, "none", False), (9.99, "none", False), (10, "small", False), (19.9, "small", False), (20, "good", False),
    (29.99, "good", False), (30, "strong", True), (40, "excellent", True), (49.9, "excellent", True), (50, "exceptional", True),
    (72, "exceptional", True),
])
def test_bands(pct, key, flagged):
    b = discount_band(pct)
    assert b["key"] == key and b["flagged"] is flagged


def test_validation_rejects_broken_values():
    assert validate_prices(None, None)[0] is False
    assert validate_prices(D("0"), None)[0] is False
    assert validate_prices(D("12000"), None)[0] is False
    assert validate_prices(D("1"), D("100"))[0] is False  # 99 % off -> parse error
    assert validate_prices(D("80"), D("100")) == (True, None)
