"""Email delivery through Resend (HTTP API) or SMTP, with retries and delivery tracking."""
from __future__ import annotations

import logging
import smtplib
import ssl
import time
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import make_msgid

import httpx
from sqlalchemy.orm import Session

from .config import Settings, get_settings
from .models import EmailReport, ScanSession

log = logging.getLogger(__name__)


class EmailNotConfigured(RuntimeError):
    pass


def send_raw(to: str, subject: str, html: str, text: str, settings: Settings | None = None) -> str | None:
    """Send once. Returns the provider message id. Raises on failure."""
    s = settings or get_settings()
    provider = s.email_provider.lower()
    if provider == "resend":
        if not s.resend_api_key:
            raise EmailNotConfigured("RESEND_API_KEY is not set")
        r = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {s.resend_api_key}"},
            json={"from": s.email_from, "to": [to], "subject": subject, "html": html, "text": text},
            timeout=30,
        )
        if r.status_code >= 400:
            raise RuntimeError(f"Resend HTTP {r.status_code}: {r.text[:300]}")
        return r.json().get("id")
    if provider == "smtp":
        if not s.smtp_host:
            raise EmailNotConfigured("SMTP_HOST is not set")
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = s.email_from, to, subject
        msg["Message-ID"] = make_msgid(domain=s.email_from.split("@")[-1].strip(">") or None)
        msg.set_content(text)
        msg.add_alternative(html, subtype="html")
        ctx = ssl.create_default_context()
        if s.smtp_use_ssl:
            with smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, context=ctx, timeout=30) as smtp:
                if s.smtp_username:
                    smtp.login(s.smtp_username, s.smtp_password)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=30) as smtp:
                if s.smtp_use_tls:
                    smtp.starttls(context=ctx)
                if s.smtp_username:
                    smtp.login(s.smtp_username, s.smtp_password)
                smtp.send_message(msg)
        return msg["Message-ID"]
    raise EmailNotConfigured("EMAIL_PROVIDER is 'none'; set it to 'resend' or 'smtp'")


def deliver(db: Session, *, to: str, subject: str, html: str, text: str, kind: str, scan: ScanSession | None = None,
            settings: Settings | None = None, sleep=time.sleep, sender=send_raw) -> EmailReport:
    """Send with retries and log every attempt in ``email_reports``."""
    s = settings or get_settings()
    rep = EmailReport(scan_id=scan.id if scan else None, kind=kind, recipient=to, subject=subject, status="pending",
                      provider=s.email_provider, html=html)
    db.add(rep)
    db.commit()
    for attempt in range(1, max(1, s.email_max_attempts) + 1):
        rep.attempts = attempt
        try:
            rep.provider_message_id = sender(to, subject, html, text, s)
            rep.status, rep.sent_at, rep.error = "sent", datetime.now(timezone.utc), None
            db.commit()
            log.info("email %s sent to %s (attempt %s)", kind, to, attempt)
            return rep
        except EmailNotConfigured as e:
            rep.status, rep.error = "skipped", str(e)
            db.commit()
            log.warning("email %s not sent: %s", kind, e)
            return rep
        except Exception as e:
            rep.error = f"attempt {attempt}: {type(e).__name__}: {e}"
            rep.status = "failed"
            db.commit()
            log.warning("email %s attempt %s failed: %s", kind, attempt, e)
            if attempt < s.email_max_attempts:
                sleep(min(300, 10 * 3 ** (attempt - 1)))
    return rep


def recipient_for(db: Session) -> str | None:
    from .scheduler import schedule_settings

    st = schedule_settings(db)
    return (st.report_email if st and st.report_email else None) or get_settings().report_recipient or None


def send_failure_notice(db: Session, scan: ScanSession) -> str:
    to = recipient_for(db)
    if not to:
        return "no recipient"
    lines = [f"Scan #{scan.id} ({scan.trigger}) finished with status: {scan.status.upper()}", ""]
    for r in scan.results:
        err = "; ".join((r.errors or [])[:2])[:300]
        lines.append(f"- {r.country_code} [{r.connector}]: {r.status} — {r.products_updated} products updated. {err}")
    lines += ["", "Historical data was not modified for countries that failed.",
              f"Scan log: {get_settings().public_app_url}/settings#scans"]
    text = "\n".join(lines)
    html = "<pre style='font-family:ui-monospace,Menlo,monospace;font-size:13px'>" + _esc(text) + "</pre>"
    subject = f"NIKE DEAL TRACKER – Scan {scan.status} – {datetime.now(timezone.utc):%Y-%m-%d}"
    return deliver(db, to=to, subject=subject, html=html, text=text, kind="failure", scan=scan).status


def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
