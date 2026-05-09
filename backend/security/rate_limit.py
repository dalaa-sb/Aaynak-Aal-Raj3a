"""Rate limiting using slowapi (Flask-Limiter port for FastAPI/Starlette)."""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Single shared limiter instance — bound to client IP.
limiter = Limiter(key_func=get_remote_address, default_limits=[])
