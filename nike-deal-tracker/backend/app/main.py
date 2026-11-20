from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.routes import api, internal, public
from .auth import api_limiter, client_ip
from .config import get_settings
from .db import SessionLocal, init_db
from .logging_setup import setup_logging
from .seed import bootstrap

log = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    setup_logging(s.log_level, s.log_json)
    init_db()
    db = SessionLocal()
    try:
        bootstrap(db)
    finally:
        db.close()
    sched = None
    if s.run_inprocess_scheduler:
        from .scheduler import InProcessScheduler

        sched = InProcessScheduler(SessionLocal)
        sched.start()
        log.info("in-process scheduler started")
    yield
    if sched:
        sched.stop()


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="Nike Deal Tracker API", version="1.0.0", lifespan=lifespan,
                  docs_url="/docs" if not s.is_production else None, redoc_url=None)
    app.add_middleware(CORSMiddleware, allow_origins=s.cors_origin_list, allow_credentials=True,
                       allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type"])

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
        if request.url.path.startswith("/api") and not api_limiter.check(client_ip(request)):
            return JSONResponse({"detail": "rate limit exceeded"}, status_code=429)
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            log.exception("unhandled error", extra={"request_id": rid, "path": request.url.path})
            return JSONResponse({"detail": "internal error", "request_id": rid}, status_code=500)
        ms = round((time.perf_counter() - start) * 1000, 1)
        response.headers["x-request-id"] = rid
        response.headers["x-content-type-options"] = "nosniff"
        response.headers["referrer-policy"] = "no-referrer"
        response.headers["x-frame-options"] = "DENY"
        if request.url.path not in ("/health",):
            log.info("%s %s %s %sms", request.method, request.url.path, response.status_code, ms,
                     extra={"request_id": rid, "path": request.url.path, "status": response.status_code, "duration_ms": ms})
        return response

    app.include_router(public)
    app.include_router(api)
    app.include_router(internal)
    return app


app = create_app()
