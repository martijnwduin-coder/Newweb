import time

import pytest
from fastapi.testclient import TestClient

from .conftest import factory_for, make_listing


@pytest.fixture
def client(session, fx):
    from app.main import create_app
    from app.scanner import Scanner

    Scanner(session, connector_factory=factory_for({
        "NL": [make_listing(price="71.95"), make_listing(sku="NI000H000-A11", name="Nike Sportswear CLUB - Hoodie - grey", price="40", original="60")],
        "DE": [make_listing("DE", price="83.95")],
    }), fx=fx).run(trigger="cli")
    with TestClient(create_app()) as c:
        yield c


def login(c):
    r = c.post("/auth/login", json={"email": "me@example.com", "password": "correct-horse-battery"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/health/ready").json()["database"] == "ok"


def test_auth_required(client):
    assert client.get("/api/deals").status_code == 401
    assert client.get("/api/deals", headers={"Authorization": "Bearer nonsense"}).status_code == 401
    assert client.post("/auth/login", json={"email": "me@example.com", "password": "wrong"}).status_code == 401


def test_login_rate_limited(client):
    codes = [client.post("/auth/login", json={"email": "x@example.com", "password": "nope"}).status_code for _ in range(10)]
    assert 429 in codes


def test_deals_filters_and_sorting(client):
    h = login(client)
    d = client.get("/api/deals", headers=h).json()
    assert d["total"] == 3 and d["sample_mode"] is False
    assert d["items"][0]["discount_pct"] >= d["items"][-1]["discount_pct"]
    assert client.get("/api/deals?country=DE", headers=h).json()["total"] == 1
    assert client.get("/api/deals?group=apparel", headers=h).json()["total"] == 1
    assert client.get("/api/deals?franchise=air-force-1&sort=price", headers=h).json()["items"][0]["country"] == "NL"
    assert client.get("/api/deals?size=42", headers=h).json()["total"] == 3
    assert client.get("/api/deals?min_discount=35", headers=h).json()["total"] == 1  # 40 % NL AF1 only
    assert client.get("/api/deals?min_discount=500", headers=h).status_code == 422
    assert client.get("/api/deals?group=bogus", headers=h).status_code == 400


def test_overview_compare_product_history(client):
    h = login(client)
    o = client.get("/api/overview", headers=h).json()
    assert o["products_tracked"] == 2 and o["next_scheduled_scan"]
    cmp = client.get("/api/compare", headers=h).json()
    assert cmp["total"] == 1 and cmp["items"][0]["cheapest_country"] == "NL"
    pid = cmp["items"][0]["product_id"]
    p = client.get(f"/api/products/{pid}", headers=h).json()
    assert {o["country"] for o in p["offers"]} == {"NL", "DE"}
    hist = client.get(f"/api/products/{pid}/history?country=NL", headers=h).json()
    assert len(hist["series"]["NL"]) == 1
    assert client.get("/api/products/9999", headers=h).status_code == 404


def test_watchlist_crud(client):
    h = login(client)
    r = client.post("/api/watchlist/rules", headers=h, json={"kind": "franchise", "franchise_slug": "air-force-1", "min_discount": 35})
    assert r.status_code == 201
    rid = r.json()["id"]
    wl = client.get("/api/watchlist", headers=h).json()
    assert wl["rules"][0]["triggered"] == 1 and len(wl["matches"]) == 1
    assert client.post("/api/watchlist/rules", headers=h, json={"kind": "franchise"}).status_code == 400
    assert client.put(f"/api/watchlist/rules/{rid}", headers=h, json={"kind": "franchise", "franchise_slug": "air-force-1", "min_discount": 60}).status_code == 200
    assert client.get("/api/watchlist", headers=h).json()["rules"][0]["triggered"] == 0
    assert client.delete(f"/api/watchlist/rules/{rid}", headers=h).status_code == 204


def test_settings_validation(client):
    h = login(client)
    s = client.get("/api/settings", headers=h).json()
    assert s["schedule_weekday"] == 0 and s["schedule_hour"] == 8 and s["timezone"] == "Europe/Amsterdam"
    assert client.put("/api/settings", headers=h, json={"schedule_hour": 7, "report_min_discount": 25}).json()["schedule_hour"] == 7
    assert client.put("/api/settings", headers=h, json={"timezone": "Mars/Base"}).status_code == 422
    assert client.put("/api/settings", headers=h, json={"schedule_hour": 25}).status_code == 422


def test_franchise_expansion(client):
    h = login(client)
    r = client.post("/api/franchises", headers=h, json={"name": "Air Superfly", "slug": "air-superfly", "group": "other", "patterns": [r"\bair superfly\b"]})
    assert r.status_code == 201
    assert client.post("/api/franchises", headers=h, json={"name": "Bad", "slug": "bad", "group": "other", "patterns": ["("]}).status_code == 422


def test_manual_scan_runs_in_background(client, monkeypatch):
    import app.api.routes as routes

    h = login(client)
    monkeypatch.setattr(routes, "Scanner", lambda db: __import__("app.scanner", fromlist=["Scanner"]).Scanner(
        db, connector_factory=factory_for({"NL": [make_listing(price="69.95")]}),
        fx=__import__("app.fx", fromlist=["FxConverter"]).FxConverter({"PLN": 4})))
    r = client.post("/api/scans/run", headers=h, json={"countries": ["NL"]})
    assert r.status_code == 202
    sid = r.json()["scan_id"]
    for _ in range(50):
        s = client.get(f"/api/scans/{sid}", headers=h).json()
        if s["status"] != "running":
            break
        time.sleep(0.1)
    assert s["status"] == "success" and s["countries"][0]["country"] == "NL"


def test_internal_requires_cron_token(client):
    assert client.get("/internal/due").status_code == 401
    assert client.get("/internal/due", headers={"X-Cron-Token": "cron-secret"}).status_code == 200


def test_report_preview(client):
    h = login(client)
    r = client.get("/api/reports/preview", headers=h)
    assert r.status_code == 200 and "NIKE DEAL TRACKER" in r.text
