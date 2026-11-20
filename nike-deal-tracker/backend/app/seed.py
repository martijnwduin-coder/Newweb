"""Idempotent reference-data seeding: countries, franchises and the first admin user."""
from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import hash_password
from .catalog.franchises import FRANCHISES
from .config import get_settings
from .connectors.registry import COUNTRY_SEED, SHIPPING_NOTE
from .models import Country, Franchise, User, UserSettings, Watchlist

log = logging.getLogger(__name__)


def seed_reference_data(db: Session) -> None:
    for code, name, domain, currency, lang, path in COUNTRY_SEED:
        c = db.get(Country, code)
        if c is None:
            db.add(Country(code=code, name=name, domain=domain, currency=currency, language=lang, nike_path=path,
                           enabled=True, shipping_note=SHIPPING_NOTE))
    existing = {f.slug: f for f in db.scalars(select(Franchise))}
    for d in FRANCHISES:
        f = existing.get(d.slug)
        if f is None:
            db.add(Franchise(slug=d.slug, name=d.name, group=d.group, priority=d.priority, patterns=list(d.patterns),
                             specificity=d.specificity, active=True, is_custom=False))
        elif not f.is_custom:
            # keep built-in definitions in sync with code
            f.name, f.group, f.priority, f.patterns, f.specificity = d.name, d.group, d.priority, list(d.patterns), d.specificity
    db.flush()


def ensure_admin(db: Session) -> User | None:
    s = get_settings()
    if db.scalar(select(User).limit(1)) is not None:
        return None
    if not s.admin_email or not s.admin_password:
        log.warning("no users exist and ADMIN_EMAIL/ADMIN_PASSWORD are not set; dashboard login is impossible")
        return None
    if len(s.admin_password) < 10:
        raise RuntimeError("ADMIN_PASSWORD must be at least 10 characters")
    return create_user(db, s.admin_email, s.admin_password, is_admin=True)


def create_user(db: Session, email: str, password: str, *, is_admin: bool = False) -> User:
    s = get_settings()
    u = User(email=email.lower().strip(), password_hash=hash_password(password), is_admin=is_admin)
    db.add(u)
    db.flush()
    db.add(UserSettings(user_id=u.id, report_email=s.report_recipient or u.email))
    db.add(Watchlist(user_id=u.id, name="My watchlist"))
    db.flush()
    log.info("created user %s", u.email)
    return u


def bootstrap(db: Session) -> None:
    seed_reference_data(db)
    ensure_admin(db)
    db.commit()
