"""
Audit log service.

Records security-relevant actions to MongoDB. The write helper never raises —
audit failure must never break the action being audited. All sensitive fields
are stripped before persistence.
"""
from datetime import datetime, timezone
from typing import Optional, Iterable
from fastapi import Request
from config.db import get_db

AUDIT = "audit_logs"

# Keys that must never be persisted to audit (defense in depth — callers shouldn't
# pass them, but if they do we drop them).
_REDACT_KEYS = {"password", "new_password", "password_hash", "reset_token",
                "verification_code", "token", "authorization", "bearer"}


def _redact(d: Optional[dict]) -> Optional[dict]:
    if not d or not isinstance(d, dict):
        return None
    cleaned = {}
    for k, v in d.items():
        if str(k).lower() in _REDACT_KEYS:
            cleaned[k] = "[REDACTED]"
        elif isinstance(v, dict):
            cleaned[k] = _redact(v)
        elif isinstance(v, str) and len(v) > 500:
            cleaned[k] = v[:500] + "…"
        else:
            cleaned[k] = v
    return cleaned


def _ip_of(request: Optional[Request]) -> Optional[str]:
    if request is None:
        return None
    try:
        # Respect X-Forwarded-For if behind a proxy, else fall back to peer addr
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip()
        return request.client.host if request.client else None
    except Exception:
        return None


def _ua_of(request: Optional[Request]) -> Optional[str]:
    if request is None:
        return None
    try:
        ua = request.headers.get("user-agent") or None
        return (ua[:300] + "…") if ua and len(ua) > 300 else ua
    except Exception:
        return None


async def log_action(
    *,
    action: str,
    actor_username: Optional[str] = None,
    actor_role: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    request: Optional[Request] = None,
) -> None:
    """
    Persist an audit event. Best-effort — never raises.
    Safe to call from any endpoint without try/except.
    """
    try:
        doc = {
            "action": str(action)[:80],
            "actor_username": (str(actor_username)[:64] if actor_username else None),
            "actor_role": (str(actor_role)[:32] if actor_role else None),
            "target_type": (str(target_type)[:48] if target_type else None),
            "target_id": (str(target_id)[:128] if target_id else None),
            "ip_address": _ip_of(request),
            "user_agent": _ua_of(request),
            "metadata": _redact(metadata),
            "created_at": datetime.now(timezone.utc),
        }
        db = get_db()
        await db[AUDIT].insert_one(doc)
    except Exception:
        # Never let audit failure block the real action
        pass


async def list_logs(
    *,
    action: Optional[str] = None,
    actor_username: Optional[str] = None,
    target_type: Optional[str] = None,
    since: Optional[datetime] = None,
    until: Optional[datetime] = None,
    limit: int = 200,
) -> list:
    """List audit logs, newest first, with optional filters."""
    db = get_db()
    q = {}
    if action and isinstance(action, str):
        q["action"] = action
    if actor_username and isinstance(actor_username, str):
        q["actor_username"] = actor_username.strip().lower()
    if target_type and isinstance(target_type, str):
        q["target_type"] = target_type
    if since or until:
        rng = {}
        if since: rng["$gte"] = since
        if until: rng["$lte"] = until
        q["created_at"] = rng

    limit = max(1, min(int(limit or 200), 1000))
    cur = db[AUDIT].find(q).sort("created_at", -1).limit(limit)
    return [doc async for doc in cur]


async def ensure_indexes():
    """Indexes for typical filter patterns. Idempotent."""
    db = get_db()
    await db[AUDIT].create_index([("created_at", -1)])
    await db[AUDIT].create_index([("action", 1), ("created_at", -1)])
    await db[AUDIT].create_index([("actor_username", 1), ("created_at", -1)])


def serialize(doc: dict) -> dict:
    """Convert mongo doc to JSON-safe dict for API response."""
    if not doc:
        return {}
    out = dict(doc)
    out["id"] = str(out.pop("_id", ""))
    if isinstance(out.get("created_at"), datetime):
        out["created_at"] = out["created_at"].isoformat()
    return out
