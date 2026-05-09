"""
Authentication middleware — re-exports from backend.security.deps for backward compat.
The actual implementation lives in backend/security/deps.py — JWT-based, no in-memory state.

Usage:
    from backend.middlewares.auth import require_auth, require_role
    @router.get("/protected")
    async def x(user=Depends(require_auth)): ...
"""
from backend.security.deps import get_current_session as require_auth
from backend.security.deps import require_role

__all__ = ["require_auth", "require_role"]
