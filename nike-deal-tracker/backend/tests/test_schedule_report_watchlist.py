from datetime import datetime, timedelta, timezone
from decimal import Decimal as D

from sqlalchemy import select

from app.models import EmailReport, Franchise, Product, User, Watchlist, WatchlistRule
from app.scanner import Scanner
from app.scheduler import is_due, next_run, scheduled_moment, tick

from .conftest import factory_for, make_listing

UTC = timezone.utc


# ------------------------------------------------------------------ schedule (Europe/Amsterdam, DST aware)
def test_monday_0800_amsterdam_in_winter_and_summer():
    winter = scheduled_moment(datetime(2026, 11, 23, 9, 0, tzinfo=UTC), 0, 8, 0, "Europe/Amsterdam")
    assert winter == datetime(2026, 11, 23, 7, 0, tzinfo=UTC)  # CET = UTC+1
    summer = scheduled_moment(datetime(2026, 6, 15, 9, 0, tzinfo=UTC), 0, 8, 0, "Europe/Amsterdam")
    assert summer == datetime(2026, 6, 15, 6, 0, tzinfo=UTC)  # CEST = UTC+2
    # across the DST switch (last Sunday of March 2027 = 28th): Monday 29th is already CEST
    assert next_run(datetime(2027, 3, 25, tzinfo=UTC)) == datetime(2027, 3, 29, 6, 0, tzinfo=UTC)


def test_is_due_window_and_once_per_week(session, fx):
    before = datetime(2026, 11, 23, 6, 30, tzinfo=UTC)  # 07:30 local: not yet
    assert is_due(session, before)[0] is False
    due, _, key = is_due(session, datetime(2026, 11, 23, 7, 20, tzinfo=UTC))
    assert due and key == "2026-W48"
    assert is_due(session, datetime(2026, 11, 23, 16, 0, tzinfo=UTC))[0] is False  # outside 8h catch-up window
    Scanner(session, connector_factory=factory_for({"NL": [make_listing()]}), fx=fx).run(trigger="schedule", week_key="2026-W48")
    assert is_due(session, datetime(2026, 11, 23, 8, 0, tzinfo=UTC))[0] is False  # already ran this week


def test_tick_runs_weekly_job_and_logs_email(session, monkeypatch, fx):
    import app.scanner as scanner_mod

    monkeypatch.setattr(scanner_mod, "build_connector", lambda n, c, s, f=None: factory_for({"NL": [make_listing()]})(n, c, s))
    monkeypatch.setattr(scanner_mod.FxConverter, "for_scan", classmethod(lambda cls, db, quotes=("PLN",), try_refresh=True: fx))
    res = tick(session, datetime(2026, 11, 23, 7, 5, tzinfo=UTC))
    assert res["ran"] and res["scan_status"] == "partial"  # NL ok, other countries had nothing
    rep = session.scalar(select(EmailReport).where(EmailReport.kind == "weekly"))
    assert rep.status == "skipped" and "EMAIL_PROVIDER" in rep.error  # provider 'none' in tests
    assert tick(session, datetime(2026, 11, 23, 8, 5, tzinfo=UTC))["ran"] is False


# ------------------------------------------------------------------ watchlist
def _rule(session, **kw):
    user = session.scalar(select(User))
    wl = session.scalar(select(Watchlist).where(Watchlist.user_id == user.id))
    r = WatchlistRule(watchlist_id=wl.id, **kw)
    session.add(r)
    session.commit()
    return user


def test_watchlist_rules(session, fx):
    from app.watchlist import evaluate

    Scanner(session, connector_factory=factory_for({
        "NL": [make_listing(price="71.95", original="119.95", sizes=["42", "44"]),
               make_listing(sku="NI000S000-A11", name="Nike Sportswear SHOX TL - Sneakers - silver", price="79.00", original="179.95")],
        "DE": [make_listing("DE", price="99.95", original="119.95", sizes=["44"])],
    }), fx=fx).run(trigger="cli")
    af1 = session.scalar(select(Franchise).where(Franchise.slug == "air-force-1"))
    shox = session.scalar(select(Franchise).where(Franchise.slug == "shox-tl"))
    _rule(session, kind="franchise", franchise_id=af1.id, min_discount=40)
    _rule(session, kind="franchise", franchise_id=shox.id, max_price_eur=D("80"))
    _rule(session, kind="franchise", franchise_id=af1.id, size="44")  # track only
    user = _rule(session, kind="colourway", colourway="white", franchise_id=af1.id, country_code="DE", min_discount=10)
    ev = evaluate(session, user.id)
    by_rule = {r["id"]: r for r in ev["rules"]}
    assert [r["triggered"] for r in by_rule.values()] == [1, 1, 0, 1]
    assert [r["tracked"] for r in by_rule.values()] == [2, 1, 2, 1]
    assert {m["deal"]["country"] for m in ev["matches"]} == {"NL", "DE"}


# ------------------------------------------------------------------ report + email
def test_report_renders_all_sections(session, fx):
    from app.report.builder import build_context, render

    s = Scanner(session, connector_factory=factory_for({"NL": [make_listing(price="59.95")], "DE": [make_listing("DE", price="64.95")]}), fx=fx).run(trigger="cli")
    ctx = build_context(session, s, now=datetime(2026, 11, 23, 7, 0, tzinfo=UTC))
    assert ctx["subject"] == "NIKE DEAL TRACKER – Weekly Zalando Deals – 23 Nov 2026"
    html, text = render(ctx)
    for section in ("A · WEEKLY OVERVIEW", "B · TOP", "C · AIR FORCE 1 SPECIAL REPORT", "D · OTHER PRIORITY FRANCHISES",
                    "E · COUNTRY COMPARISON", "F · PRICE DROPS", "G · WATCHLIST ALERTS"):
        assert section in html
    assert "cheapest of 2 countries" in html and "SAMPLE DATA" not in html
    assert "AIR FORCE 1 07" in text


def test_report_says_so_when_nothing_significant(session, fx):
    from app.report.builder import build_context, render

    s = Scanner(session, connector_factory=factory_for({"NL": [make_listing(price="110.00", original="119.95")]}), fx=fx).run(trigger="cli")
    html, _ = render(build_context(session, s))
    assert "No significant deals this week" in html


def test_sample_report_is_labelled(session, fx):
    from app.connectors.sample import SampleConnector
    from app.report.builder import build_context

    s = Scanner(session, connector_factory=lambda n, c, st: SampleConnector(), fx=fx).run(trigger="cli", connector_override="sample")
    assert build_context(session, s)["subject"].startswith("[SAMPLE DATA]")


def test_email_retries_then_records_failure(session):
    from app.emailer import deliver

    attempts = []

    def flaky(to, subject, html, text, settings):
        attempts.append(1)
        raise RuntimeError("SMTP 421")

    rep = deliver(session, to="me@example.com", subject="s", html="<p>x</p>", text="x", kind="weekly", sleep=lambda s: None, sender=flaky)
    assert len(attempts) == 3 and rep.status == "failed" and rep.attempts == 3 and "421" in rep.error


def test_email_success_after_retry(session):
    from app.emailer import deliver

    n = {"i": 0}

    def sender(*a):
        n["i"] += 1
        if n["i"] == 1:
            raise RuntimeError("timeout")
        return "msg-123"

    rep = deliver(session, to="me@example.com", subject="s", html="x", text="x", kind="weekly", sleep=lambda s: None, sender=sender)
    assert rep.status == "sent" and rep.provider_message_id == "msg-123" and rep.attempts == 2
