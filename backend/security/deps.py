"""
FastAPI dependencies for token validation and role-based access control.
Tokens come from the `Authorization: Bearer <jwt>` header — never query strings.
"""
from typing import Optional, Iterable
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.security.tokens import decode_token

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_session(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    """
    Validate the JWT and return its payload. Raises 401 if missing/invalid/expired.
    Use as a FastAPI dependency on any protected endpoint.
    """
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    payload = decode_token(creds.credentials, expected_type="session")
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    return {
        "username": payload.get("sub"),
        "role": payload.get("role"),
        "exp": payload.get("exp"),
        "jti": payload.get("jti"),
    }


def require_role(allowed: Iterable[str]):
    """Dependency factory: require the session role to be in `allowed`."""
    allowed_set = set(allowed)

    async def _checker(session: dict = Depends(get_current_session)) -> dict:
        if session.get("role") not in allowed_set:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return session

    return _checker


require_admin = require_role(["admin"])
require_any_user = require_role(["admin", "security"])
