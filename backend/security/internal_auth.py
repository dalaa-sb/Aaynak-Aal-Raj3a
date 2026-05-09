"""
Internal-service authentication for the AI module → backend ingest endpoints.

The AI module (queue detection, tracking) runs on the same machine in dev,
or on an edge device in production. Either way, it's a trusted internal client
and does NOT have a user JWT — it identifies itself with a shared secret.

This is separate from the user authentication system (JWT/bcrypt). It exists
specifically to prevent random clients from posting fake queue counts or
tracking events to a publicly-hosted backend.

Configuration (env var, set on Render and the AI host):
    INTERNAL_API_KEY=<long-random-string>

If the env var is empty/missing, the check is disabled (dev convenience).
In production deployment, ALWAYS set this. The check uses constant-time
comparison to avoid timing-attack leakage.
"""
import os
import hmac
from fastapi import Header, HTTPException, status

INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "").strip()


def require_internal_auth(x_internal_auth: str = Header(default=None)):
    """FastAPI dependency for AI ingest endpoints.

    Behavior:
      - If INTERNAL_API_KEY env var is empty → no check (dev mode, accept any caller)
      - Otherwise, the request must include header `X-Internal-Auth: <secret>`
        with a value matching INTERNAL_API_KEY. Constant-time compare.

    Returns the matched key string on success (unused by callers, but present
    so callers can inject the dep without unused-arg warnings).
    """
    if not INTERNAL_API_KEY:
        # Dev mode — no internal key configured. Accept any caller.
        # Production deployments must set INTERNAL_API_KEY.
        return None

    if not x_internal_auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Internal-Auth header",
        )

    if not hmac.compare_digest(x_internal_auth, INTERNAL_API_KEY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid internal authentication",
        )
    return x_internal_auth
