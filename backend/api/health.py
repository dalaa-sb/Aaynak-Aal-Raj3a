"""
Health endpoints.

GET /api/health           — public, lightweight summary
GET /api/health/details   — admin-only, includes config validation
"""
import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from backend.security.deps import require_admin
from config.db import get_db
from config import settings

router = APIRouter(prefix="/api/health", tags=["health"])


def _jwt_strength() -> str:
    """Classify JWT secret strength without leaking it."""
    secret = settings.JWT_SECRET or ""
    if not secret or "CHANGE_ME" in secret:
        return "missing_or_default"
    if len(secret) < 32:
        return "weak"
    if len(secret) < 64:
        return "ok"
    return "strong"


async def _mongo_ok() -> tuple[str, str | None]:
    try:
        db = get_db()
        await db.command("ping")
        return "online", None
    except Exception as e:
        # Surface a short, redacted message — not the full traceback
        msg = str(e).split("\n")[0][:200]
        return "offline", msg


def _ws_status() -> str:
    """Best-effort check that WebSocket manager exists in alert_service."""
    try:
        from backend.services import alert_service
        return "online" if getattr(alert_service, "ws_manager", None) is not None else "warning"
    except Exception:
        return "unknown"


def _reports_ok() -> str:
    try:
        from backend.services import report_service, pdf_generator  # noqa: F401
        return "online"
    except Exception:
        return "offline"


def _ai_status() -> str:
    """The AI pipeline is a separate process; we expose mode info, not liveness."""
    try:
        # If the AI module imports cleanly, it's available — actual frame processing
        # happens in run_ai.py as a separate process.
        import importlib.util
        spec = importlib.util.find_spec("ai.queue_analytics.detector")
        return "available" if spec is not None else "demo_mode"
    except Exception:
        return "demo_mode"


@router.get("/")
async def health_summary():
    """Public lightweight health check."""
    mongo_status, _ = await _mongo_ok()
    return {
        "status": "ok" if mongo_status == "online" else "degraded",
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "components": {
            "api": "online",
            "database": mongo_status,
            "reports": _reports_ok(),
            "ai_module": _ai_status(),
        },
    }


@router.get("/details")
async def health_details(session: dict = Depends(require_admin)):
    """Admin-only detailed health, including config validation. No secrets exposed."""
    mongo_status, mongo_err = await _mongo_ok()

    # Verify required env vars are present (not their values)
    env_checks = {
        "MONGO_URL": bool(settings.MONGO_URL and "localhost" not in settings.MONGO_URL),
        "MONGO_DB_NAME": bool(settings.MONGO_DB_NAME),
        "JWT_SECRET": _jwt_strength() in ("ok", "strong"),
        "CORS_ORIGINS": bool(settings.CORS_ORIGINS),
    }

    return {
        "status": "ok" if mongo_status == "online" and all(env_checks.values()) else "degraded",
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "components": {
            "api":            {"status": "online"},
            "database":       {"status": mongo_status, "error": mongo_err},
            "reports":        {"status": _reports_ok()},
            "websockets":     {"status": _ws_status()},
            "ai_module":      {"status": _ai_status(),
                               "note": "AI processing runs as a separate process (run_ai.py)"},
        },
        "configuration": {
            "mongo_configured":  env_checks["MONGO_URL"],
            "db_name_configured": env_checks["MONGO_DB_NAME"],
            "jwt_secret_strength": _jwt_strength(),
            "cors_origins_configured": env_checks["CORS_ORIGINS"],
            "cors_origins_count": len(settings.CORS_ORIGINS or []),
        },
    }
