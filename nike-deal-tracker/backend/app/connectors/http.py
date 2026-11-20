"""A deliberately polite HTTP client.

* obeys robots.txt (and its Crawl-delay) for every host,
* waits at least ``min_delay`` seconds between requests to the same host,
* retries only transient failures (timeouts, 429, 5xx) with exponential backoff,
* treats 401/403, bot challenges and CAPTCHAs as a hard stop: it raises
  ``AccessBlocked`` and never tries to get around them,
* caches successful responses on disk so re-runs don't hit the shop again.
"""
from __future__ import annotations

import hashlib
import json
import logging
import random
import time
from collections.abc import Callable
from pathlib import Path
from urllib import robotparser
from urllib.parse import urlsplit

import httpx

from .base import AccessBlocked, ConnectorError

log = logging.getLogger(__name__)

CHALLENGE_MARKERS = (
    "captcha", "are you a robot", "access denied", "x-edge-error", "please verify you are a human",
    "bot detection", "challenge-platform", "_incapsula_", "px-captcha",
)


class PoliteClient:
    def __init__(
        self,
        *,
        user_agent: str,
        min_delay: float = 4.0,
        timeout: float = 30.0,
        max_retries: int = 3,
        cache_dir: str | None = ".cache/http",
        cache_ttl_hours: float = 12.0,
        accept_language: str = "en",
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.user_agent = user_agent
        self.min_delay = min_delay
        self.max_retries = max_retries
        self.cache_dir = Path(cache_dir) if cache_dir else None
        self.cache_ttl = cache_ttl_hours * 3600
        self.sleep = sleep
        self.requests_made = 0
        self._last_request: dict[str, float] = {}
        self._robots: dict[str, tuple[robotparser.RobotFileParser | None, float | None]] = {}
        self._client = httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            transport=transport,
            headers={
                "User-Agent": user_agent,
                "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
                "Accept-Language": accept_language,
            },
        )

    # ------------------------------------------------------------------ robots
    def _robots_for(self, url: str) -> tuple[robotparser.RobotFileParser | None, float | None]:
        parts = urlsplit(url)
        host = f"{parts.scheme}://{parts.netloc}"
        if host in self._robots:
            return self._robots[host]
        robots_url = f"{host}/robots.txt"
        self._throttle(parts.netloc)
        try:
            r = self._client.get(robots_url)
            self.requests_made += 1
        except httpx.HTTPError as e:
            raise AccessBlocked(f"robots.txt unreachable for {parts.netloc}: {e}") from e
        if r.status_code in (404, 410):
            entry = (None, None)  # no robots.txt -> everything allowed
        elif r.status_code == 200 and not self._looks_like_challenge(r):
            rp = robotparser.RobotFileParser()
            rp.parse(r.text.splitlines())
            delay = rp.crawl_delay(self.user_agent) or rp.crawl_delay("*")
            entry = (rp, float(delay) if delay else None)
        else:
            # 401/403/5xx or a bot wall on robots.txt itself: be conservative and do not crawl.
            raise AccessBlocked(f"robots.txt for {parts.netloc} returned HTTP {r.status_code}; not crawling")
        self._robots[host] = entry
        return entry

    def allowed(self, url: str) -> bool:
        rp, _ = self._robots_for(url)
        return True if rp is None else rp.can_fetch(self.user_agent, url)

    # ------------------------------------------------------------------ cache
    def _cache_path(self, url: str) -> Path | None:
        if not self.cache_dir:
            return None
        return self.cache_dir / (hashlib.sha256(url.encode()).hexdigest() + ".json")

    def _cache_get(self, url: str) -> str | None:
        p = self._cache_path(url)
        if not p or not p.exists():
            return None
        try:
            data = json.loads(p.read_text())
        except (OSError, ValueError):
            return None
        if time.time() - data.get("fetched_at", 0) > self.cache_ttl:
            return None
        return data.get("text")

    def _cache_put(self, url: str, text: str) -> None:
        p = self._cache_path(url)
        if not p:
            return
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps({"url": url, "fetched_at": time.time(), "text": text}))

    # ------------------------------------------------------------------ fetch
    def _throttle(self, netloc: str, extra_delay: float | None = None) -> None:
        delay = max(self.min_delay, extra_delay or 0)
        last = self._last_request.get(netloc)
        if last is not None:
            wait = delay - (time.monotonic() - last)
            if wait > 0:
                self.sleep(wait + random.uniform(0, delay * 0.25))
        self._last_request[netloc] = time.monotonic()

    @staticmethod
    def _looks_like_challenge(r: httpx.Response) -> bool:
        if r.headers.get("x-edge-error") or r.headers.get("cf-mitigated"):
            return True
        head = r.text[:20000].lower()
        title_block = "<title>" in head and any(m in head for m in ("captcha", "are you a robot", "access denied"))
        return title_block or any(m in head for m in ("px-captcha", "_incapsula_", "challenge-platform"))

    def get_text(self, url: str, *, use_cache: bool = True) -> str:
        if use_cache:
            cached = self._cache_get(url)
            if cached is not None:
                return cached
        rp, crawl_delay = self._robots_for(url)
        if rp is not None and not rp.can_fetch(self.user_agent, url):
            raise ConnectorError(f"disallowed by robots.txt: {url}")
        netloc = urlsplit(url).netloc
        attempt = 0
        while True:
            attempt += 1
            self._throttle(netloc, crawl_delay)
            try:
                r = self._client.get(url)
                self.requests_made += 1
            except (httpx.TimeoutException, httpx.TransportError) as e:
                if attempt > self.max_retries:
                    raise ConnectorError(f"network error after {attempt} attempts: {url}: {e}") from e
                self.sleep(min(60, 2 ** attempt))
                continue
            if r.status_code in (401, 403) or self._looks_like_challenge(r):
                raise AccessBlocked(f"HTTP {r.status_code} / access protection on {netloc}; stopping this country")
            if r.status_code == 429 or r.status_code >= 500:
                if attempt > self.max_retries:
                    raise ConnectorError(f"HTTP {r.status_code} after {attempt} attempts: {url}")
                retry_after = r.headers.get("retry-after", "")
                wait = float(retry_after) if retry_after.isdigit() else 2 ** attempt * 5
                self.sleep(min(wait, 120))
                continue
            if r.status_code == 404:
                raise ConnectorError(f"HTTP 404: {url}")
            if r.status_code >= 400:
                raise ConnectorError(f"HTTP {r.status_code}: {url}")
            self._cache_put(url, r.text)
            return r.text

    def get_bytes(self, url: str) -> bytes:
        """For authorised feed downloads (no robots.txt check: the URL is issued to us by the provider)."""
        attempt = 0
        while True:
            attempt += 1
            try:
                r = self._client.get(url)
                self.requests_made += 1
            except (httpx.TimeoutException, httpx.TransportError) as e:
                if attempt > self.max_retries:
                    raise ConnectorError(f"feed download failed: {e}") from e
                self.sleep(min(60, 2 ** attempt))
                continue
            if r.status_code in (401, 403):
                raise AccessBlocked(f"feed returned HTTP {r.status_code}: check the feed URL / API key")
            if r.status_code == 429 or r.status_code >= 500:
                if attempt > self.max_retries:
                    raise ConnectorError(f"feed HTTP {r.status_code}")
                self.sleep(min(120, 2 ** attempt * 5))
                continue
            if r.status_code >= 400:
                raise ConnectorError(f"feed HTTP {r.status_code}")
            return r.content

    def close(self) -> None:
        self._client.close()
