"""SAMPLE DATA connector for interface testing ONLY.

Everything it produces is fictional, flagged ``is_sample=True`` and shown with a
"SAMPLE DATA" banner in the dashboard and the email. SKUs start with ``SMPL``.
Use ``python -m app.cli purge-sample`` to remove it before going live.
"""
from __future__ import annotations

import random
from collections.abc import Iterator
from decimal import Decimal
from urllib.parse import quote_plus

from .base import Connector, CountryConfig, RawListing

SEARCH_PATH = {"NL": "/catalogus/", "DE": "/katalog/", "FR": "/catalogue/", "ES": "/catalogo/", "PL": "/katalog/"}
TYPE_WORD = {
    "sneakers": {"NL": "Sneakers laag", "DE": "Sneaker low", "FR": "Baskets basses", "ES": "Zapatillas", "PL": "Sneakersy niskie"},
    "running": {"NL": "Hardloopschoenen neutraal", "DE": "Laufschuh Neutral", "FR": "Chaussures de running neutres", "ES": "Zapatillas de running neutras", "PL": "Obuwie do biegania treningowe"},
    "training": {"NL": "Trainingsschoen", "DE": "Trainingsschuh", "FR": "Chaussures de training", "ES": "Zapatillas de entrenamiento", "PL": "Obuwie treningowe"},
    "basketball": {"NL": "Basketbalschoenen", "DE": "Basketballschuh", "FR": "Chaussures de basket", "ES": "Zapatillas de baloncesto", "PL": "Obuwie do koszykówki"},
    "hoodie": {"NL": "Hoodie", "DE": "Kapuzenpullover", "FR": "Sweat à capuche", "ES": "Sudadera con capucha", "PL": "Bluza z kapturem"},
    "tshirt": {"NL": "T-shirt basic", "DE": "T-Shirt basic", "FR": "T-shirt basique", "ES": "Camiseta básica", "PL": "T-shirt basic"},
    "jacket": {"NL": "Trainingsjack", "DE": "Trainingsjacke", "FR": "Veste de survêtement", "ES": "Chaqueta de entrenamiento", "PL": "Kurtka sportowa"},
    "socks": {"NL": "Sokken", "DE": "Socken", "FR": "Chaussettes", "ES": "Calcetines", "PL": "Skarpety"},
    "backpack": {"NL": "Rugzak", "DE": "Rucksack", "FR": "Sac à dos", "ES": "Mochila", "PL": "Plecak"},
}

# (sample sku, model, type, colourway, list price EUR, gender)
SAMPLE_PRODUCTS = [
    ("SMPL00001-A11", "Nike Sportswear AIR FORCE 1 '07", "sneakers", "white/white", 119.99, "men"),
    ("SMPL00002-B12", "Nike Sportswear AIR FORCE 1 '07", "sneakers", "black/black", 119.99, "men"),
    ("SMPL00003-C13", "Nike Sportswear AIR FORCE 1 '07 LV8", "sneakers", "sail/team orange", 129.99, "men"),
    ("SMPL00004-D14", "Nike Sportswear W AIR FORCE 1 SHADOW", "sneakers", "pale ivory/rose", 139.99, "women"),
    ("SMPL00005-E15", "Nike Sportswear AIR MAX 90", "sneakers", "black/white", 149.99, "men"),
    ("SMPL00006-F16", "Nike Sportswear AIR MAX 90", "sneakers", "photon dust/grey", 149.99, "women"),
    ("SMPL00007-G17", "Nike Sportswear SHOX TL", "sneakers", "metallic silver", 179.99, "unisex"),
    ("SMPL00008-H18", "Nike Sportswear AIR SKYLON II", "sneakers", "white/game royal", 129.99, "men"),
    ("SMPL00009-I19", "Nike Performance VOMERO PLUS", "running", "black/volt", 189.99, "men"),
    ("SMPL00010-J20", "Nike Performance PEGASUS 42", "running", "white/racer blue", 139.99, "women"),
    ("SMPL00011-K21", "Jordan AIR JORDAN 1 LOW", "sneakers", "white/varsity red", 129.99, "men"),
    ("SMPL00012-L22", "Jordan AIR JORDAN 1 MID SE", "sneakers", "sail/olive", 139.99, "women"),
    ("SMPL00013-M23", "Nike Performance METCON 10", "training", "black/anthracite", 149.99, "men"),
    ("SMPL00014-N24", "Nike Performance CAITLIN CLARK 1", "basketball", "white/gold", 129.99, "unisex"),
    ("SMPL00015-O25", "Nike Sportswear DUNK LOW RETRO", "sneakers", "panda", 119.99, "men"),
    ("SMPL00016-P26", "Nike Sportswear AIR MAX PLUS", "sneakers", "black/hyper blue", 189.99, "men"),
    ("SMPL00017-Q27", "Nike Sportswear P-6000", "sneakers", "metallic silver/sail", 119.99, "women"),
    ("SMPL00018-R28", "Nike Performance VOMERO 5", "running", "cobblestone/flat pewter", 169.99, "unisex"),
    ("SMPL00019-S29", "Nike Sportswear CLUB FLEECE", "hoodie", "dark grey heather", 69.99, "men"),
    ("SMPL00020-T30", "Nike Performance TECH FLEECE", "jacket", "black", 129.99, "men"),
    ("SMPL00021-U31", "Nike Sportswear TEE", "tshirt", "white", 29.99, "women"),
    ("SMPL00022-V32", "Nike Performance EVERYDAY CUSHIONED 3 PACK", "socks", "white", 18.99, "unisex"),
    ("SMPL00023-W33", "Nike Sportswear HERITAGE", "backpack", "black", 39.99, "unisex"),
]

SHOE_SIZES = ["38", "39", "40", "40.5", "41", "42", "42.5", "43", "44", "44.5", "45", "46"]
APPAREL_SIZES = ["XS", "S", "M", "L", "XL", "XXL"]
COUNTRY_FACTOR = {"NL": 1.0, "DE": 0.97, "FR": 1.02, "ES": 0.99, "PL": 0.95}
PLN_PER_EUR = 4.30  # sample-only; real scans use the ECB rate


class SampleConnector(Connector):
    name = "sample"

    def __init__(self, week: int = 0) -> None:
        super().__init__()
        self.week = week  # lets the seeder fabricate a *labelled* sample history

    def collect(self, country: CountryConfig) -> Iterator[RawListing]:
        for sku, model, kind, colour, list_eur, gender in SAMPLE_PRODUCTS:
            rnd = random.Random(f"{sku}-{country.code}-{self.week}")
            if rnd.random() < 0.08:
                continue  # not listed in this country this week
            base = list_eur * COUNTRY_FACTOR[country.code]
            disc = rnd.choice([0, 0, 0, 10, 15, 20, 25, 30, 35, 40, 45, 50])
            price = base * (1 - disc / 100)
            if country.currency == "PLN":
                base, price = base * PLN_PER_EUR, price * PLN_PER_EUR
            sizes_pool = APPAREL_SIZES if kind in ("hoodie", "tshirt", "jacket") else (["S", "M", "L"] if kind in ("socks", "backpack") else SHOE_SIZES)
            sizes = sorted(rnd.sample(sizes_pool, k=max(1, rnd.randint(1, len(sizes_pool)))), key=sizes_pool.index)
            name = f"{model} - {TYPE_WORD[kind][country.code]} - {colour}"
            q = quote_plus(f"nike {model.split(' ', 2)[-1].lower()}")
            yield RawListing(
                country=country.code, source="sample", name=name,
                url=f"{country.base_url}{SEARCH_PATH[country.code]}?q={q}",
                price=Decimal(f"{price:.2f}"), original_price=Decimal(f"{base:.2f}") if disc else None,
                currency=country.currency, brand="Nike", sku=sku, colour=colour, gender_hint=gender,
                image_url=None, sizes=sizes, sizes_known=True, in_stock=True, is_sample=True,
            )
