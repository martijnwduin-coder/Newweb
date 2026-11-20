import pytest

from app.catalog.classifier import classify, extract_sku, is_nike, match_franchise


@pytest.mark.parametrize("name", [
    "Nike Sportswear AIR FORCE 1 '07 - Sneakers laag - white",
    "Nike Sportswear AIR FORCE 1 07 - Sneaker low - weiß",
    "Nike Sportswear AIR FORCE 1 '07 - Baskets basses - blanc",
    "Nike Sportswear AIR FORCE 1 LOW - Zapatillas - white",
    "Nike Sportswear AF1 - Sneakersy niskie - biały",
    "Nike Air Force 1 Low",
    "Nike Sportswear AIR FORCE 1 07 - Sneakers laag - white",
    "Nike Sportswear W AIR FORCE 1 SHADOW - Sneakers laag - pale ivory",
])
def test_air_force_1_names_across_countries(name):
    assert classify(name).franchise_slug == "air-force-1"


@pytest.mark.parametrize("name,slug", [
    ("Jordan AIR JORDAN 1 LOW - Sneakers laag", "air-jordan-1"),
    ("Jordan AIR JORDAN 1 MID SE - Sneaker high", "air-jordan-1"),
    ("Jordan AIR JORDAN 11 RETRO - Sneaker high", "air-jordan-11"),
    ("Jordan AIR JORDAN 4 RETRO - Sneakers", "air-jordan-4"),
    ("Nike Sportswear AIR MAX 90 - Sneakers laag", "air-max-90"),
    ("Nike Sportswear AIR MAX 1 '86 - Sneakers", "air-max-1"),
    ("Nike Sportswear AIR MAX DN8 - Sneaker low", "air-max-dn8"),
    ("Nike Sportswear AIR MAX DN - Sneaker low", "air-max-dn"),
    ("Nike Sportswear AIR MAX PLUS - Sneakers", "air-max-plus"),
    ("Nike Sportswear AIR MAX INTRLK LITE - Sneakers laag", "air-max-other"),
    ("Nike Performance ZOOMX VOMERO PLUS - Laufschuh Neutral", "vomero-plus"),
    ("Nike Performance VOMERO 18 - Hardloopschoenen neutraal", "vomero-18"),
    ("Nike Performance PEGASUS 42 - Zapatillas de running neutras", "pegasus-42"),
    ("Nike Performance PEGASUS PREMIUM - Laufschuh", "pegasus-premium"),
    ("Nike Performance METCON 10 - Trainingsschuh", "metcon-10"),
    ("Nike Performance FREE METCON 6 - Trainingsschuh", "free-metcon"),
    ("Nike Performance CAITLIN CLARK 1 - Basketbalschoenen", "caitlin-1"),
    ("Nike Sportswear SHOX TL - Sneaker low", "shox-tl"),
    ("Nike Sportswear AIR SKYLON II - Sneakers", "skylon"),
    ("Nike Sportswear P-6000 UNISEX - Sneakers laag", "p-6000"),
    ("Nike Sportswear DUNK LOW RETRO - Sneakers", "dunk-low"),
    ("Nike Performance JA 2 - Basketballschuh", "ja"),
])
def test_franchises(name, slug):
    assert classify(name).franchise_slug == slug


def test_apparel_never_gets_a_shoe_franchise():
    c = classify("Jordan AIR JORDAN 1 - Hoodie - black")
    assert c.franchise_slug is None and c.category == "apparel" and c.subcategory == "hoodie"


@pytest.mark.parametrize("name,cat,sub", [
    ("Nike Performance EVERYDAY CUSH CREW 3 PACK - Sportsokken - white", "accessories", "socks"),
    ("Nike Sportswear CLUB - Pet - anthracite", "accessories", "cap"),
    ("Nike Sportswear HERITAGE - Rugzak - black", "accessories", "backpack"),
    ("Nike Performance DRI-FIT - Sport-BH - black", "apparel", "sports-bra"),
    ("Nike Sportswear TECH FLEECE - Trainingsbroek - black", "apparel", "sweatpants"),
    ("Nike Sportswear - Szorty - blue", "apparel", "shorts"),
    ("Nike Sportswear CLUB - Sweat à capuche - grey", "apparel", "hoodie"),
    ("Nike Sportswear TEE - T-shirt basic - white", "apparel", "t-shirt"),
    ("Nike Sportswear WINDRUNNER - Veste de survêtement - black", "apparel", "jacket"),
    ("Nike Performance - Legginsy - pink", "apparel", "sweatpants"),
    ("Nike Sportswear AIR FORCE 1 - Sneakers hoog - white", "footwear", "sneakers"),
])
def test_categories(name, cat, sub):
    c = classify(name)
    assert (c.category, c.subcategory) == (cat, sub)


def test_silhouette_hint_used():
    c = classify("Nike Sportswear UNISEX - Bluza - grey", category_hint="sweater")
    assert c.category == "apparel"


def test_colourway_and_model_kept_separately():
    a = classify("Nike Sportswear AIR FORCE 1 '07 - Sneakers laag - white/white")
    b = classify("Nike Sportswear AIR FORCE 1 '07 - Sneakers laag - black/black")
    assert a.franchise_slug == b.franchise_slug == "air-force-1"
    assert a.colourway == "white/white" and b.colourway == "black/black"
    assert a.model == "AIR FORCE 1 '07"


@pytest.mark.parametrize("name,gender_hint,expected", [
    ("Nike Sportswear W AIR MAX 90 - Sneakers laag", None, "women"),
    ("Nike Sportswear AIR MAX 90 GS - Sneakers", None, "kids"),
    ("Nike Sportswear AIR MAX 90 - Sneakers", "men", "men"),
    ("Nike Sportswear AIR MAX 90 - Sneakers", None, "unisex"),
])
def test_gender(name, gender_hint, expected):
    assert classify(name, gender_hint=gender_hint).gender == expected


def test_sku_extraction():
    assert extract_sku("https://www.zalando.nl/nike-sportswear-air-force-1-07-sneakers-laag-white-ni112n022-a11.html") == "NI112N022-A11"
    assert extract_sku("NI112N022-A110060000") == "NI112N022-A11"  # simple SKU -> config SKU
    assert extract_sku("no sku here") is None


def test_is_nike():
    assert is_nike("Nike Sportswear", "x") and is_nike("Jordan", "x") and is_nike(None, "Nike AF1")
    assert not is_nike("adidas Originals", "Nike-like shoe")


def test_custom_franchise_pool():
    from app.catalog.classifier import compile_franchises
    from app.catalog.franchises import FranchiseDef

    pool = compile_franchises([FranchiseDef("air-superfly", "Air Superfly", "other", 2, [r"\bair superfly\b"]), FranchiseDef("bad", "Bad", "other", 2, ["("])])
    assert match_franchise("Nike AIR SUPERFLY - Sneakers", pool).slug == "air-superfly"
