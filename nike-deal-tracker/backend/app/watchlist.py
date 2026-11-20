"""Watchlist rule evaluation.

A rule *tracks* everything it selects (product / franchise / colourway, optionally a
size and a country). If it also has a threshold (``min_discount`` and/or
``max_price_eur``) a selected listing *triggers* an alert only when every threshold is met.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .analytics import DealFilters, load_rows
from .models import Franchise, Watchlist, WatchlistRule


def rule_selects(rule: WatchlistRule, row: dict, franchise_slugs: dict[int, str]) -> bool:
    if rule.kind == "product" and row["product_id"] != rule.product_id:
        return False
    if rule.kind == "franchise":
        slug = franchise_slugs.get(rule.franchise_id or -1)
        if not row["franchise"] or row["franchise"]["slug"] != slug:
            return False
    if rule.kind == "colourway":
        needle = (rule.colourway or "").strip().lower()
        if not needle or needle not in (row["colourway"] or "").lower():
            return False
        if rule.franchise_id is not None:
            slug = franchise_slugs.get(rule.franchise_id)
            if not row["franchise"] or row["franchise"]["slug"] != slug:
                return False
    if rule.country_code and row["country"] != rule.country_code.upper():
        return False
    if rule.size:
        want = rule.size.strip().lower()
        if not any(str(s).strip().lower() == want for s in row["sizes"]):
            return False
    return True


def rule_triggers(rule: WatchlistRule, row: dict) -> bool:
    has_threshold = rule.min_discount is not None or rule.max_price_eur is not None
    if not has_threshold:
        return False
    if not row["in_stock"]:
        return False
    if rule.min_discount is not None and row["discount_pct"] < rule.min_discount:
        return False
    if rule.max_price_eur is not None and row["price_eur"] > float(rule.max_price_eur):
        return False
    return True


def describe_rule(rule: WatchlistRule, franchise_names: dict[int, str], product_names: dict[int, str] | None = None) -> str:
    if rule.label:
        return rule.label
    if rule.kind == "product":
        target = (product_names or {}).get(rule.product_id or -1, f"product #{rule.product_id}")
    elif rule.kind == "franchise":
        target = f"all {franchise_names.get(rule.franchise_id or -1, '?')}"
    else:
        target = f"colourway '{rule.colourway}'" + (f" of {franchise_names.get(rule.franchise_id)}" if rule.franchise_id else "")
    parts = [target]
    if rule.size:
        parts.append(f"size {rule.size}")
    if rule.country_code:
        parts.append(f"in {rule.country_code}")
    if rule.min_discount is not None:
        parts.append(f"at ≥{rule.min_discount}% off")
    if rule.max_price_eur is not None:
        parts.append(f"below €{float(rule.max_price_eur):.2f}")
    return " · ".join(parts)


def evaluate(db: Session, user_id: int, rows: list[dict] | None = None) -> dict:
    """Return {"rules": [...], "matches": [...], "watched_variant_ids": set}"""
    wl_ids = list(db.scalars(select(Watchlist.id).where(Watchlist.user_id == user_id)))
    rules = list(db.scalars(select(WatchlistRule).where(WatchlistRule.watchlist_id.in_(wl_ids), WatchlistRule.active.is_(True))))
    fr = {f.id: f for f in db.scalars(select(Franchise))}
    slugs = {i: f.slug for i, f in fr.items()}
    names = {i: f.name for i, f in fr.items()}
    if rows is None:
        rows = load_rows(db, DealFilters(in_stock_only=False))
    product_names = {r["product_id"]: f"{r['name']}" for r in rows}
    matches = []
    watched: set[int] = set()
    rule_out = []
    for rule in rules:
        sel = [r for r in rows if rule_selects(rule, r, slugs)]
        trig = [r for r in sel if rule_triggers(rule, r)]
        for r in sel:
            watched.add(r["variant_id"])
        rule_out.append({"id": rule.id, "description": describe_rule(rule, names, product_names), "tracked": len(sel), "triggered": len(trig)})
        for r in trig:
            matches.append({"rule_id": rule.id, "rule": describe_rule(rule, names, product_names), "deal": r})
    matches.sort(key=lambda m: m["deal"]["discount_pct"], reverse=True)
    return {"rules": rule_out, "matches": matches, "watched_variant_ids": watched}
