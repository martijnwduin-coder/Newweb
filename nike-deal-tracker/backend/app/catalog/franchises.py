"""Nike franchise catalogue (seed data).

Patterns are regular expressions applied to the *normalised* product name
(lower case, accents removed, punctuation turned into spaces, see
``classifier.normalise``). Add new franchises here, or at runtime through
``POST /api/franchises`` (stored in the database, ``is_custom = true``).

``specificity`` decides which franchise wins when several match:
"Air Max Dn8" matches both ``air-max-dn8`` and ``air-max-dn``; the higher number wins.
Generic catch-alls (``air-max-other`` ...) have a low specificity.
"""
from __future__ import annotations

from dataclasses import dataclass, field

# Navigation groups used by the dashboard
GROUPS = {
    "air-force-1": "Air Force 1",
    "air-max": "Air Max",
    "running": "Running",
    "basketball": "Basketball",
    "training": "Training",
    "other": "Other Nike",
    "apparel": "Apparel",
}


@dataclass(frozen=True)
class FranchiseDef:
    slug: str
    name: str
    group: str
    priority: int
    patterns: list[str] = field(default_factory=list)
    specificity: int = 100
    query: str | None = None  # Zalando search text; defaults to the name

    @property
    def search_query(self) -> str | None:
        if self.specificity < 50:
            return None  # catch-alls are covered by the brand-wide crawl
        return self.query or self.name


F = FranchiseDef

FRANCHISES: list[FranchiseDef] = [
    # ---------------- Priority 1: core franchises ----------------
    F("air-force-1", "Air Force 1", "air-force-1", 1, [r"\bair force 1\b", r"\bair force one\b", r"\baf ?1\b"]),
    F("air-max-90", "Air Max 90", "air-max", 1, [r"\bair max 90\b", r"\bam ?90\b"]),
    F("shox-tl", "Shox TL", "other", 1, [r"\bshox tl\b"]),
    F("skylon", "Skylon", "other", 1, [r"\bskylon\b"]),
    F("vomero-plus", "Vomero Plus", "running", 1, [r"\bvomero plus\b", r"\bvomero\+"]),
    F("pegasus-42", "Pegasus 42", "running", 1, [r"\bpegasus 42\b"]),
    F("air-jordan-1", "Air Jordan 1", "basketball", 1, [r"\b(air )?jordan 1\b", r"\baj ?1\b"]),
    F("metcon-10", "Metcon 10", "training", 1, [r"\bmetcon 10\b"]),
    F("caitlin-1", "Caitlin Clark 1", "basketball", 1, [r"\bcaitlin( clark)? 1\b", r"\bcaitlin clark\b", r"\bcc ?1\b"], query="Caitlin Clark"),
    # ---------------- Priority 2: other major franchises ----------------
    F("air-max-1", "Air Max 1", "air-max", 2, [r"\bair max 1\b", r"\bair max 1 86\b"]),
    F("air-max-95", "Air Max 95", "air-max", 2, [r"\bair max 95\b"]),
    F("air-max-97", "Air Max 97", "air-max", 2, [r"\bair max 97\b"]),
    F("air-max-dn8", "Air Max Dn8", "air-max", 2, [r"\bair max dn ?8\b"], 120),
    F("air-max-dn", "Air Max Dn", "air-max", 2, [r"\bair max dn\b"]),
    F("air-max-plus", "Air Max Plus / TN", "air-max", 2, [r"\bair max plus\b", r"\btn\b", r"\btuned\b"], query="Air Max Plus"),
    F("air-max-sc", "Air Max SC", "air-max", 2, [r"\bair max sc\b"]),
    F("air-max-excee", "Air Max Excee", "air-max", 2, [r"\bair max excee\b"]),
    F("vomero-5", "Vomero 5", "running", 2, [r"\bvomero 5\b"]),
    F("vomero-18", "Vomero 18", "running", 2, [r"\bvomero 18\b"]),
    F("vomero-17", "Vomero 17", "running", 2, [r"\bvomero 17\b"]),
    F("pegasus-41", "Pegasus 41", "running", 2, [r"\bpegasus 41\b"]),
    F("pegasus-premium", "Pegasus Premium", "running", 2, [r"\bpegasus premium\b"], 110),
    F("p-6000", "P-6000", "other", 2, [r"\bp ?6000\b"]),
    F("v2k-run", "V2K Run", "other", 2, [r"\bv2k\b"], query="V2K"),
    F("cortez", "Cortez", "other", 2, [r"\bcortez\b"]),
    F("dunk-low", "Dunk Low", "other", 2, [r"\bdunk low\b"]),
    F("dunk-high", "Dunk High", "other", 2, [r"\bdunk high\b"]),
    F("air-jordan-3", "Air Jordan 3", "basketball", 2, [r"\b(air )?jordan 3\b", r"\baj ?3\b"]),
    F("air-jordan-4", "Air Jordan 4", "basketball", 2, [r"\b(air )?jordan 4\b", r"\baj ?4\b"]),
    F("air-jordan-11", "Air Jordan 11", "basketball", 2, [r"\b(air )?jordan 11\b", r"\baj ?11\b"]),
    F("blazer", "Blazer", "other", 2, [r"\bblazer\b"]),
    F("killshot", "Killshot", "other", 2, [r"\bkillshot\b"]),
    F("field-general", "Field General", "other", 2, [r"\bfield general\b"]),
    F("waffle", "Waffle", "other", 2, [r"\bwaffle\b"]),
    F("zoom-fly", "Zoom Fly", "running", 2, [r"\bzoom fly\b"]),
    F("streakfly", "Streakfly", "running", 2, [r"\bstreakfly\b"]),
    F("structure", "Structure", "running", 2, [r"\bstructure\b"]),
    F("invincible-run", "Invincible Run", "running", 2, [r"\binvincible\b"], query="Invincible"),
    F("free-metcon", "Free Metcon", "training", 2, [r"\bfree metcon\b"], 110),
    F("romaleos", "Romaleos", "training", 2, [r"\bromaleos\b"]),
    F("sabrina", "Sabrina", "basketball", 2, [r"\bsabrina\b"]),
    F("lebron", "LeBron", "basketball", 2, [r"\blebron\b"]),
    F("giannis", "Giannis", "basketball", 2, [r"\bgiannis\b", r"\bzoom freak\b", r"\bimmortality\b"]),
    F("ja", "Ja", "basketball", 2, [r"\bja ?[1-9]\b", r"\bja morant\b"], query="Ja 2"),
    # ---------------- Generic catch-alls (low specificity) ----------------
    F("air-max-other", "Air Max (other)", "air-max", 2, [r"\bair max\b"], 10),
    F("pegasus-other", "Pegasus (other)", "running", 2, [r"\bpegasus\b"], 10),
    F("vomero-other", "Vomero (other)", "running", 2, [r"\bvomero\b"], 10),
    F("metcon-other", "Metcon (other)", "training", 2, [r"\bmetcon\b"], 10),
    F("jordan-other", "Jordan (other)", "basketball", 2, [r"\bjordan\b"], 5),
]

PRIORITY_1_SLUGS = [f.slug for f in FRANCHISES if f.priority == 1]
