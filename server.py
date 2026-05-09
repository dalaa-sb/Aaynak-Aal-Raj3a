"""
🛫 Airport AI Monitoring System — Main Server (MongoDB + secure auth)
Run: python server.py
  or: uvicorn server:app --reload --host 0.0.0.0 --port 8000
"""
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from config.settings import API_HOST, API_PORT, CORS_ORIGINS, ALLOWED_HOSTS, ZONES
from config.db import connect_db, close_db, get_db

from backend.websocket.manager import ConnectionManager
from backend.api import alerts, queue, tracking, auth, dashboard, reports, audit, health
from backend.api import settings as settings_api, map as map_api
from backend.services import alert_service, queue_service, tracking_service, user_service
from backend.services import audit_service
from backend.security.rate_limit import limiter

# ─── WebSocket Manager ────────────────────────────────────
ws_manager = ConnectionManager()
alert_service.set_ws_manager(ws_manager)
queue_service.set_ws_manager(ws_manager)
tracking_service.set_ws_manager(ws_manager)


# ─── Seed zone_status collection ──────────────────────────
async def seed_zones():
    db = get_db()
    for zone_id, info in ZONES.items():
        existing = await db.zone_status.find_one({"zone": zone_id})
        if not existing:
            await db.zone_status.insert_one({
                "zone": zone_id, "zone_type": info["type"].value,
                "current_occupancy": 0, "avg_wait_minutes": 0.0,
                "status": "normal", "updated_at": datetime.utcnow(),
            })
    print(f"✅ {len(ZONES)} zones seeded")


# ─── App Lifecycle ────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await seed_zones()
    await user_service.ensure_indexes()
    await audit_service.ensure_indexes()
    print("🛫 Airport Monitor API running (MongoDB + secure auth)")
    yield
    await close_db()
    print("🛬 Shutting down")


# ─── Create App ───────────────────────────────────────────
app = FastAPI(
    title="Airport AI Monitor",
    description="Real-time airport monitoring with secure auth",
    version="3.0.0",
    lifespan=lifespan,
)

# Rate limiter wiring
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": f"Too many requests. Limit: {exc.detail}"})

# HTTP Host header attack protection — only respond to allowed hosts.
# Without this, an attacker can craft a request with a malicious Host header
# (matters when password-reset emails or absolute URLs are built from request.url).
app.add_middleware(TrustedHostMiddleware, allowed_hosts=ALLOWED_HOSTS)

# Tightened CORS — explicit origins only, no wildcard with credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ─── Routers ────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(alerts.router)
app.include_router(queue.router)
app.include_router(tracking.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(audit.router)
app.include_router(health.router)
app.include_router(settings_api.router)
app.include_router(map_api.router)


# ─── WebSocket ──────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    """Real-time alert push channel.

    Authentication: requires a valid session JWT, passed as ?token=... query param.
    Browsers cannot set custom headers on WebSocket connections, so the query
    string is the standard way to authenticate WS clients. The token is the same
    JWT issued at /api/auth/login (stored in sessionStorage on the client).

    Connection flow:
      1. Client opens WS with ?token=<jwt>
      2. We decode and validate the token (signature, expiration, type='session')
      3. On success: accept, register, push alerts in real time
      4. On failure: close with 1008 (policy violation) so the client knows
         the connection was rejected for auth reasons (not a network error)
    """
    from backend.security.tokens import decode_token

    # Validate token BEFORE accepting the connection
    if not token:
        await websocket.close(code=1008, reason="Missing token")
        return
    payload = decode_token(token, expected_type="session")
    if not payload:
        await websocket.close(code=1008, reason="Invalid or expired token")
        return

    # Optional: stash the username on the socket for future per-user filtering
    # (current broadcasts go to all; this leaves a hook for later)
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


# ─── Health ─────────────────────────────────────────────
@app.get("/")
def root():
    return {"service": "Airport AI Monitor", "database": "MongoDB", "status": "running", "docs": "/docs"}

@app.get("/health")
async def health():
    try:
        db = get_db()
        await db.command("ping")
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host=API_HOST, port=API_PORT, reload=True)
