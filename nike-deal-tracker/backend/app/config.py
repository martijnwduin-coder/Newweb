"""Application configuration. Every secret comes from the environment, nothing is hardcoded."""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- core -------------------------------------------------------------
    environment: str = "development"
    database_url: str = "sqlite:///./nike_tracker.db"
    log_level: str = "INFO"
    log_json: bool = False

    # --- auth -------------------------------------------------------------
    jwt_secret: str = Field(default="", description="Required in production. openssl rand -hex 32")
    jwt_ttl_hours: int = 24 * 7
    admin_email: str = ""
    admin_password: str = ""  # only used to bootstrap the first user; hashed in the database
    cron_token: str = ""  # shared secret for POST /internal/* (scheduler pings)

    # --- CORS / frontend --------------------------------------------------
    cors_origins: str = "http://localhost:3000"
    public_app_url: str = "http://localhost:3000"

    # --- email ------------------------------------------------------------
    email_provider: str = "none"  # resend | smtp | none
    email_from: str = "Nike Deal Tracker <deals@example.com>"
    report_recipient: str = ""  # default recipient; can be overridden in Settings UI
    resend_api_key: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True  # STARTTLS on 587; set smtp_use_ssl for 465
    smtp_use_ssl: bool = False
    email_max_attempts: int = 3

    # --- data collection --------------------------------------------------
    # per-country connector: "zalando_web" | "feed" | "disabled"
    connector_nl: str = "zalando_web"
    connector_de: str = "zalando_web"
    connector_fr: str = "zalando_web"
    connector_es: str = "zalando_web"
    connector_pl: str = "zalando_web"
    # Affiliate / authorized feed URLs (e.g. Awin "Create-a-Feed" download URL) per country
    feed_url_nl: str = ""
    feed_url_de: str = ""
    feed_url_fr: str = ""
    feed_url_es: str = ""
    feed_url_pl: str = ""
    feed_format: str = "awin"  # column mapping preset: awin | generic

    http_user_agent: str = "NikeDealTracker/1.0 (+personal price monitor; respectful crawler)"
    http_min_delay_seconds: float = 4.0  # minimum gap between requests to the same host
    http_timeout_seconds: float = 30.0
    http_max_retries: int = 3
    http_cache_dir: str = ".cache/http"
    http_cache_ttl_hours: float = 12.0
    # zalando_web crawl plan (per country). Roughly sale + franchise + popular + detail requests.
    zalando_sale_pages: int = 25  # "?order=sale" pages per brand path (nike, jordan); 24 priced items each
    zalando_popular_pages: int = 4
    zalando_franchise_pages: int = 1  # popularity-ordered pages per priority-1 franchise search
    zalando_include_priority2_searches: bool = True
    zalando_brand_paths: str = "/nike/,/jordan/"
    max_detail_pages_per_country: int = 60  # product pages for priority products (sizes, stock, shipping)

    # --- scheduler --------------------------------------------------------
    run_inprocess_scheduler: bool = False  # set true when the API runs on an always-on host
    github_repository: str = ""  # owner/repo, enables "Run scan now" via workflow_dispatch
    github_token: str = ""
    github_workflow_file: str = "nike-weekly-scan.yml"
    github_ref: str = "main"
    scan_executor: str = "local"  # local | github

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def connector_for(self, country: str) -> str:
        return getattr(self, f"connector_{country.lower()}", "disabled")

    def feed_url_for(self, country: str) -> str:
        return getattr(self, f"feed_url_{country.lower()}", "")

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.is_production and len(s.jwt_secret) < 32:
        raise RuntimeError("JWT_SECRET must be set (>= 32 chars) in production")
    if not s.jwt_secret:
        # development only: stable per-process secret
        import secrets

        s.jwt_secret = secrets.token_hex(32)
    return s
