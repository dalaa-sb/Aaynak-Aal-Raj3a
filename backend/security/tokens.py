"""JWT helpers — signed, time-limited tokens for sessions and password reset."""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict
import jwt
from config.settings import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_MINUTES, RESET_TOKEN_EXPIRE_MINUTES


def create_session_token(*, username: str, role: str, expires_minutes: Optional[int] = None) -> tuple[str, int]:
    """Create a signed JWT for a user session. Returns (token, expires_in_seconds)."""
    expires_minutes = expires_minutes or JWT_EXPIRE_MINUTES
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=expires_minutes)
    payload = {
        "sub": username,
        "role": role,
        "type": "session",
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "jti": secrets.token_hex(8),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token, expires_minutes * 60


def create_reset_token(username: str) -> tuple[str, datetime]:
    """Create a single-use password reset token. Returns (token, expires_at)."""
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": username,
        "type": "password_reset",
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "jti": secrets.token_hex(16),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token, exp


def decode_token(token: str, expected_type: Optional[str] = None) -> Optional[Dict]:
    """Verify signature + expiration. Returns payload or None on any failure."""
    if not token or not isinstance(token, str):
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
    except Exception:
        return None

    if expected_type and payload.get("type") != expected_type:
        return None
    return payload


def generate_verification_code() -> str:
    """Generate a 6-digit numeric verification code."""
    return f"{secrets.randbelow(1_000_000):06d}"
