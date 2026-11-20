"""Schedule logic shared by every executor (GitHub Actions cron, system cron, in-process loop).

External cron fires *often* (e.g. hourly on Mondays); ``tick()`` decides whether the
weekly job is due, using the schedule stored in the database (Settings page), and makes
sure it runs at most once per ISO week.
"""
from __future__ import annotations

import logging
import threading
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import ScanSession, UserSettings

log = logging.getLogger(__name__)

CATCH_UP_WINDOW = timedelta(hours=8)  # a late cron run (GitHub can lag) still counts


def schedule_settings(db: Session) -> UserSettings | None:
    return db.scalar(select(UserSettings).order_by(UserSettings.id).limit(1))


def scheduled_moment(now: datetime, weekday: int, hour: int, minute: int, tz: str) -> datetime:
    """The most recent scheduled moment at or before ``now`` (aware, UTC)."""
    local = now.astimezone(ZoneInfo(tz))
    days_back = (local.weekday() - weekday) % 7
    candidate = (local - timedelta(days=days_back)).replace(hour=hour, minute=minute, second=0, microsecond=0)
    if candidate > local:
        candidate -= timedelta(days=7)
    # re-localise to handle DST correctly
    candidate = datetime(candidate.year, candidate.month, candidate.day, hour, minute, tzinfo=ZoneInfo(tz))
    return candidate.astimezone(timezone.utc)


def next_run(now: datetime, weekday: int = 0, hour: int = 8, minute: int = 0, tz: str = "Europe/Amsterdam") -> datetime:
    last = scheduled_moment(now, weekday, hour, minute, tz)
    local_last = last.astimezone(ZoneInfo(tz))
    nxt = local_last + timedelta(days=7)
    nxt = datetime(nxt.year, nxt.month, nxt.day, hour, minute, tzinfo=ZoneInfo(tz))
    return nxt.astimezone(timezone.utc)


def week_key(moment: datetime, tz: str) -> str:
    y, w, _ = moment.astimezone(ZoneInfo(tz)).isocalendar()
    return f"{y}-W{w:02d}"


def is_due(db: Session, now: datetime | None = None) -> tuple[bool, str, str | None]:
    """Return (due, reason, week_key)."""
    now = now or datetime.now(timezone.utc)
    st = schedule_settings(db)
    wd, h, m, tz = (st.schedule_weekday, st.schedule_hour, st.schedule_minute, st.timezone) if st else (0, 8, 0, "Europe/Amsterdam")
    moment = scheduled_moment(now, wd, h, m, tz)
    key = week_key(moment, tz)
    if now - moment > CATCH_UP_WINDOW:
        nxt = next_run(now, wd, h, m, tz).astimezone(ZoneInfo(tz))
        return False, f"Not due now. Next weekly run: {nxt:%a %d %b %H:%M} ({tz}).", key
    done = db.scalar(select(ScanSession).where(ScanSession.week_key == key, ScanSession.trigger == "schedule", ScanSession.status != "failed").limit(1))
    if done:
        return False, f"This week's scan ({key}) already ran: scan #{done.id}, {done.status}.", key
    failed = list(db.scalars(select(ScanSession).where(ScanSession.week_key == key, ScanSession.trigger == "schedule")))
    if len(failed) >= 3:
        return False, f"weekly scan for {key} failed 3 times; not retrying automatically", key
    return True, f"Due: {moment.astimezone(ZoneInfo(tz)):%a %d %b %H:%M} slot ({key}).", key


def run_weekly_job(db: Session, *, trigger: str = "schedule", week_key: str | None = None, send_email: bool = True) -> dict:
    """Scan all countries, then generate and send the report (or a failure notice)."""
    from .emailer import send_failure_notice
    from .report.builder import send_weekly_report
    from .scanner import run_scan

    scan = run_scan(db, trigger=trigger, week_key=week_key)
    out: dict = {"scan_id": scan.id, "scan_status": scan.status}
    if not send_email:
        return out
    st = schedule_settings(db)
    if scan.status == "failed":
        if st is None or st.notify_on_failure:
            out["failure_notice"] = send_failure_notice(db, scan)
        # still send the report if older valid data exists? No: we never present stale data as this week's.
        return out
    if st is None or st.report_enabled:
        rep = send_weekly_report(db, scan)
        out["report_id"], out["report_status"] = rep.id, rep.status
        if scan.status == "partial" and (st is None or st.notify_on_failure):
            out["failure_notice"] = send_failure_notice(db, scan)
    return out


def tick(db: Session, now: datetime | None = None) -> dict:
    due, reason, key = is_due(db, now)
    log.info("scheduler tick: %s", reason)
    if not due:
        return {"ran": False, "reason": reason}
    return {"ran": True, "reason": reason, **run_weekly_job(db, week_key=key)}


class InProcessScheduler(threading.Thread):
    """Optional: for always-on hosts (Docker/VPS). Checks every 5 minutes."""

    daemon = True

    def __init__(self, session_factory, interval: int = 300) -> None:
        super().__init__(name="ndt-scheduler")
        self.session_factory = session_factory
        self.interval = interval
        self._stop = threading.Event()

    def run(self) -> None:  # pragma: no cover - timing loop
        while not self._stop.is_set():
            try:
                with self.session_factory() as db:
                    tick(db)
            except Exception:
                log.exception("scheduler tick failed")
            self._stop.wait(self.interval)

    def stop(self) -> None:
        self._stop.set()
        time.sleep(0)
