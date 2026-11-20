"""Nike product identification and classification.

Works on names in Dutch, German, French, Spanish, Polish and English, e.g.
``Nike Sportswear AIR FORCE 1 '07 - Sneakers laag - white`` (NL) and
``Nike Sportswear AIR FORCE 1 07 - Sneaker low - weiß`` (DE) both map to the
``air-force-1`` franchise, while the colourway and SKU remain distinct.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from .franchises import FRANCHISES, FranchiseDef

SKU_RE = re.compile(r"\b([A-Z0-9]{9})-([A-Z0-9]{3})(?:[A-Z0-9]*)\b", re.I)
URL_SKU_RE = re.compile(r"-([a-z0-9]{9})-([a-z0-9]{3})\.html", re.I)

BRAND_PREFIXES = [
    "nike sportswear", "nike performance", "nike golf", "nike acg", "nike sb",
    "jordan brand", "jordan", "nike",
]
NIKE_BRANDS = re.compile(r"\b(nike|jordan|nike sportswear|nike performance|nike sb|nike acg)\b", re.I)


def normalise(text: str | None) -> str:
    if not text:
        return ""
    t = unicodedata.normalize("NFKD", text)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = t.lower().replace("ł", "l")
    t = re.sub(r"['’‘`´]", "", t)  # '07 -> 07
    t = re.sub(r"[^a-z0-9+]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def extract_sku(*candidates: str | None) -> str | None:
    """Return the Zalando *config* SKU (``AAAAAAAAA-BBB``) from an ID, SKU or URL."""
    for c in candidates:
        if not c:
            continue
        m = URL_SKU_RE.search(c)
        if m:
            return f"{m.group(1)}-{m.group(2)}".upper()
        m = SKU_RE.search(c)
        if m:
            return f"{m.group(1)}-{m.group(2)}".upper()
    return None


def is_nike(brand: str | None, name: str | None) -> bool:
    if brand:
        return bool(NIKE_BRANDS.search(brand))
    return bool(name and NIKE_BRANDS.search(name))


# --------------------------------------------------------------------- categories
def _kw(*words: str) -> re.Pattern[str]:
    return re.compile(r"\b(" + "|".join(words) + r")\b")


# subcategory -> (category, pattern) ; first match wins, so the order matters
SUBCATEGORY_RULES: list[tuple[str, str, re.Pattern[str]]] = [
    ("socks", "accessories", _kw("sokken", "sok", "socken", "socks", "sock", "chaussettes", "calcetines", "skarpety", "skarpetki")),
    ("backpack", "accessories", _kw("rugzak", "rucksack", "rucksacke", "backpack", "sac a dos", "mochila", "plecak")),
    ("bag", "accessories", _kw("tas", "tassen", "tasche", "taschen", "bag", "sac", "sacs", "bolsa", "bolso", "torba", "heuptas", "gymtas", "sporttasche", "sac de sport", "bolsa de deporte", "torba sportowa", "saszetka", "schoudertas")),
    ("cap", "accessories", _kw("pet", "petten", "cap", "caps", "kappe", "casquette", "gorra", "czapka", "czapka z daszkiem", "beanie", "muts", "mutze", "bonnet", "hat", "hut", "bucket")),
    ("accessory", "accessories", _kw("handschoenen", "handschuhe", "gloves", "gants", "guantes", "rekawiczki", "zweetband", "schweissband", "sweatband", "bidon", "trinkflasche", "gourde", "botella", "bidon", "sjaal", "schal", "echarpe", "bufanda", "szalik", "headband", "haarband")),
    ("sports-bra", "apparel", _kw("sport bh", "sportbeha", "sport beha", "sports bra", "bra", "brassiere", "brassiere de sport", "sujetador deportivo", "sujetador", "biustonosz sportowy", "biustonosz", "stanik sportowy")),
    ("jacket", "apparel", _kw("jas", "jassen", "jack", "jacke", "jacket", "veste", "chaqueta", "kurtka", "parka", "windbreaker", "anorak", "bodywarmer", "weste", "doudoune", "plumifero", "chubasquero", "trainingsjack", "trainingsjacke", "regenjas", "winterjas", "coat", "mantel", "manteau", "abrigo", "plaszcz", "gilet")),
    ("hoodie", "apparel", _kw("hoodie", "hoody", "capuchon", "capuchontrui", "kapuzenpullover", "kapuzensweatshirt", "sweat a capuche", "sudadera con capucha", "bluza z kapturem")),
    ("sweatshirt", "apparel", _kw("sweater", "sweatshirt", "sweat", "trui", "pullover", "pulli", "bluza", "sudadera", "fleece", "crew", "crewneck")),
    ("t-shirt", "apparel", _kw("t shirt", "tshirt", "shirt", "tee", "top", "tank", "tanktop", "longsleeve", "koszulka", "camiseta", "polo", "poloshirt", "debardeur", "haut de sport", "sportshirt", "functioneel shirt", "funktionsshirt", "maillot")),
    ("shorts", "apparel", _kw("short", "shorts", "korte broek", "kurze hose", "kurze sporthose", "pantalon court", "pantalones cortos", "pantalon corto", "szorty", "spodenki")),
    ("sweatpants", "apparel", _kw("joggingbroek", "jogginghose", "trainingsbroek", "trainingshose", "sweatpants", "joggers", "jogger", "pantalon de survetement", "pantalon de chandal", "spodnie dresowe", "broek", "hose", "pantalon", "pantalones", "spodnie", "legging", "leggings", "legginsy", "spodnie treningowe", "tights", "tight", "sporthose")),
    ("tracksuit", "apparel", _kw("trainingspak", "trainingsanzug", "tracksuit", "survetement", "chandal", "dres", "komplet dresowy", "joggingpak")),
    ("dress", "apparel", _kw("jurk", "kleid", "robe", "vestido", "sukienka", "rok", "rock", "jupe", "falda", "spodnica")),
    ("swim", "apparel", _kw("badpak", "zwembroek", "badeanzug", "badehose", "maillot de bain", "banador", "kostium kapielowy", "bikini")),
]

FOOTWEAR_RE = _kw(
    "sneaker", "sneakers", "sneakers laag", "sneakers hoog", "schoen", "schoenen", "schuh", "schuhe", "laufschuh",
    "laufschuhe", "hardloopschoen", "hardloopschoenen", "chaussure", "chaussures", "baskets", "basket", "zapatilla",
    "zapatillas", "zapatos", "buty", "trainers", "shoe", "shoes", "sandaal", "sandalen", "sandale", "sandales",
    "sandalias", "sandaly", "slipper", "slippers", "badslippers", "badeschuh", "badelatschen", "claquettes",
    "chanclas", "klapki", "mules", "boots", "laarzen", "stiefel", "bottes", "botas", "trailschoen", "trail",
    "trainingsschoen", "hallenschuh", "basketbalschoen", "basketballschuh", "chaussures de basket",
    "zapatillas de baloncesto", "buty do koszykowki", "fitnessschoen", "fitnessschuh", "chaussures de running",
    "zapatillas de running", "buty do biegania", "voetbalschoen", "fussballschuh", "crampons", "botas de futbol",
    "korki", "low top", "high top", "low", "hoog", "laag", "high", "mid",
)

# German/Dutch compound words: "Sportsokken", "Sporttasche", "Regenjas", "Trainingsbroek", "Funktionsshirt"
COMPOUND_RULES: list[tuple[str, str, re.Pattern[str]]] = [
    ("socks", "accessories", re.compile(r"\b\w+(sokken|socken)\b")),
    ("backpack", "accessories", re.compile(r"\b\w+(rugzak|rucksack)\b")),
    ("bag", "accessories", re.compile(r"\b\w+(tas|tasche)\b")),
    ("sports-bra", "apparel", re.compile(r"\b\w*(beha)\b")),
    ("jacket", "apparel", re.compile(r"\b\w+(jas|jacke|jack)\b")),
    ("t-shirt", "apparel", re.compile(r"\b\w+(shirt)\b")),
    ("shorts", "apparel", re.compile(r"\b\w+(short|shorts)\b")),
    ("sweatpants", "apparel", re.compile(r"\b\w+(broek|hose)\b")),
]

# German/Dutch compounds: "Trainingsschuh", "Basketbalschoenen", "Hallenschuhe"
COMPOUND_FOOTWEAR_RE = re.compile(r"\b\w+(schuh|schuhe|schoen|schoenen)\b")

GENDER_RULES: list[tuple[str, re.Pattern[str]]] = [
    ("kids", _kw("kids", "kid", "kinder", "kinderen", "kind", "junior", "jongens", "meisjes", "jungen", "madchen",
                 "enfant", "enfants", "garcon", "fille", "nino", "nina", "ninos", "dzieci", "dzieciece", "dla dzieci",
                 "chlopiec", "dziewczynka", "gs", "ps", "td", "baby", "babys", "bebe", "youth", "teen", "big kids",
                 "little kids", "jr")),
    ("women", _kw("women", "womens", "woman", "dames", "dame", "damen", "femme", "femmes", "mujer", "mujeres",
                  "damskie", "damski", "damska", "kobiety", "w", "wmns", "ladies")),
    ("men", _kw("men", "mens", "man", "heren", "herren", "homme", "hommes", "hombre", "hombres", "meskie", "meski",
                "meska", "mezczyzni", "m")),
]


@dataclass
class Classification:
    franchise_slug: str | None
    category: str  # footwear | apparel | accessories | other
    subcategory: str | None
    gender: str  # men | women | kids | unisex
    model: str | None
    colourway: str | None


CompiledPool = list[tuple[FranchiseDef, list[re.Pattern[str]]]]


def compile_franchises(defs: list[FranchiseDef]) -> CompiledPool:
    out: CompiledPool = []
    for d in defs:
        pats = []
        for p in d.patterns:
            try:
                pats.append(re.compile(p))
            except re.error:
                continue  # an invalid custom pattern must never break a scan
        out.append((d, pats))
    return out


_COMPILED = compile_franchises(FRANCHISES)


def match_franchise(name: str, pool: CompiledPool | None = None) -> FranchiseDef | None:
    norm = normalise(name)
    pool = pool if pool is not None else _COMPILED
    best: tuple[int, int, FranchiseDef] | None = None
    for d, pats in pool:
        for p in pats:
            m = p.search(norm)
            if m:
                # specificity first, then length of the matched text (longer = more specific)
                key = (d.specificity, len(m.group(0)), d)
                if best is None or key[:2] > best[:2]:
                    best = key
                break
    return best[2] if best else None


def classify_category(name: str, category_hint: str | None = None) -> tuple[str, str | None]:
    """Return (category, subcategory). ``category_hint`` is the shop's own category text if known."""
    texts = [normalise(category_hint), normalise(name)] if category_hint else [normalise(name)]
    for text in texts:
        if not text:
            continue
        # The middle part of a Zalando name ("... - Sneakers laag - ...") is the product type;
        # check it first so that a colour like "pet" or a model word can't mislead us.
        for sub, cat, pat in SUBCATEGORY_RULES:
            if pat.search(text):
                # "Sneakers laag" never contains apparel words; but guard e.g. "Air Max 90 - Sneakers - top"
                if FOOTWEAR_RE.search(text) and cat != "accessories" and sub not in ("sports-bra",):
                    if _footwear_dominant(text):
                        return "footwear", _footwear_sub(text)
                return cat, sub
        if FOOTWEAR_RE.search(text) or COMPOUND_FOOTWEAR_RE.search(text):
            return "footwear", _footwear_sub(text)
        for sub, cat, pat in COMPOUND_RULES:
            if pat.search(text):
                return cat, sub
    return "other", None


def _footwear_dominant(text: str) -> bool:
    return bool(re.search(r"\b(sneaker|sneakers|schoen|schoenen|schuh|schuhe|baskets|zapatillas|buty|trainers|shoes|laufschuhe|chaussures)\b", text))


def _footwear_sub(text: str) -> str:
    if re.search(r"\b(sandaal|sandalen|sandale|sandales|sandalias|sandaly|slipper|slippers|badslippers|claquettes|chanclas|klapki|mules|badelatschen)\b", text):
        return "sandals"
    if re.search(r"\b(hardloop|laufschuh|laufschuhe|running|biegania|trail|neutral|stabil)\w*\b", text):
        return "running"
    if re.search(r"\b(basketbal|basketball|baloncesto|koszykowki|basket)\w*\b", text) and not re.search(r"\bbaskets\b", text):
        return "basketball"
    if re.search(r"\b(training|fitness|trainingsschoen|crossfit|gym)\w*\b", text):
        return "training"
    return "sneakers"


def classify_gender(*texts: str | None) -> str:
    for t in texts:
        n = normalise(t)
        if not n:
            continue
        for g, pat in GENDER_RULES:
            for m in pat.finditer(n):
                word = m.group(0)
                # single-letter markers only count as a leading "W NIKE ..." / "M NIKE ..."
                if len(word) == 1 and m.start() != 0:
                    continue
                return g
    return "unisex"


def split_zalando_name(name: str) -> tuple[str, str | None, str | None]:
    """'Nike Sportswear AIR FORCE 1 '07 - Sneakers laag - white' -> (model part, type part, colour part)."""
    parts = [p.strip() for p in re.split(r"\s+[-–—]\s+", name) if p.strip()]
    if len(parts) >= 3:
        return parts[0], parts[1], " - ".join(parts[2:])
    if len(parts) == 2:
        return parts[0], parts[1], None
    return name.strip(), None, None


def strip_brand(text: str) -> str:
    t = text.strip()
    low = t.lower()
    for b in BRAND_PREFIXES:
        if low.startswith(b + " "):
            return t[len(b) + 1:].strip()
    return t


def classify(
    name: str,
    *,
    colour: str | None = None,
    category_hint: str | None = None,
    gender_hint: str | None = None,
    url: str | None = None,
    pool: CompiledPool | None = None,
) -> Classification:
    model_part, type_part, colour_part = split_zalando_name(name)
    category, sub = classify_category(type_part or name, category_hint)
    if category == "other" and type_part:
        category, sub = classify_category(name, category_hint)
    franchise = match_franchise(model_part, pool) or match_franchise(name, pool)
    if franchise and category == "other":
        category, sub = "footwear", "sneakers"
    # franchises describe shoes; a "Jordan" hoodie must not be counted as an Air Jordan deal
    if category != "footwear":
        franchise = None
    gender = classify_gender(gender_hint, url_gender(url), strip_brand(model_part), name)
    model = strip_brand(model_part) if model_part else None
    colourway = (colour or colour_part or None)
    if colourway:
        colourway = colourway.strip().strip("-").strip() or None
    return Classification(franchise.slug if franchise else None, category, sub, gender, model, colourway)


_URL_GENDER = {
    "men": ("/heren", "/herren", "/homme", "/hombre", "/mezczyzni", "/men"),
    "women": ("/dames", "/damen", "/femme", "/mujer", "/kobiety", "/women"),
    "kids": ("/kinderen", "/kinder", "/enfant", "/nino", "/dzieci", "/kids"),
}


def url_gender(url: str | None) -> str | None:
    if not url:
        return None
    u = url.lower()
    for g, frags in _URL_GENDER.items():
        if any(f in u for f in frags):
            return g
    return None
