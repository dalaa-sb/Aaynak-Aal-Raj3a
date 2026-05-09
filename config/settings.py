"""
Central configuration — thresholds, cameras, zones, roles.
ALL secrets come from .env. No hardcoded credentials. No default users.
"""
import os
from enum import Enum
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ─── Server ───────────────────────────────────────────────
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

# Tightened CORS — read explicit origins from env
CORS_ORIGINS = [o.strip() for o in os.getenv(
    "CORS_ORIGINS", "http://localhost:3000,http://localhost:5173"
).split(",") if o.strip()]

# TrustedHostMiddleware allow-list — protects against HTTP Host header attacks.
# In dev: localhost variants. In prod: set ALLOWED_HOSTS to your real backend domain(s).
ALLOWED_HOSTS = [h.strip() for h in os.getenv(
    "ALLOWED_HOSTS", "localhost,127.0.0.1,testserver,0.0.0.0"
).split(",") if h.strip()]

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()

# ─── MongoDB ──────────────────────────────────────────────
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "aarvision")

# ─── JWT ──────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))

if not JWT_SECRET or "CHANGE_ME" in JWT_SECRET or len(JWT_SECRET) < 32:
    import warnings
    warnings.warn(
        "JWT_SECRET is missing or weak. Set a strong random value (64+ hex chars) in .env. "
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
    )

# ─── Auth security ───────────────────────────────────────
RESET_TOKEN_EXPIRE_MINUTES = int(os.getenv("RESET_TOKEN_EXPIRE_MINUTES", "15"))
VERIFICATION_CODE_EXPIRE_MINUTES = int(os.getenv("VERIFICATION_CODE_EXPIRE_MINUTES", "15"))
DEV_PRINT_VERIFICATION_CODES = os.getenv("DEV_PRINT_VERIFICATION_CODES", "true").lower() == "true"

# ─── ID Upload ────────────────────────────────────────────
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
ID_UPLOAD_DIR = UPLOAD_DIR / "id"
MAX_UPLOAD_SIZE_BYTES = int(os.getenv("MAX_UPLOAD_SIZE_MB", "5")) * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# Create upload dirs at import (safe to call multiple times)
ID_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ─── AI Queue Analytics Thresholds ────────────────────────
QUEUE_LENGTH_WARNING = 15
QUEUE_LENGTH_CRITICAL = 30
CROWD_DENSITY_WARNING = 0.6
CROWD_DENSITY_CRITICAL = 0.85
PROCESSING_FPS = 10

# ─── Face Tracking Thresholds ─────────────────────────────
MAX_AREA_STAY_MINUTES = 30
RESTRICTED_ZONE_RE_ENTRY_LIMIT = 2
SUSPICIOUS_LOITER_MINUTES = 15

# ─── Camera Configuration ─────────────────────────────────
CAMERAS = {
    "CAM-01": {"name": "Check-in Hall A", "type": "queue",    "zone": "check_in_a", "source": 0},
    "CAM-02": {"name": "Check-in Hall B", "type": "queue",    "zone": "check_in_b", "source": 0},
    "CAM-03": {"name": "Security Gate 1", "type": "tracking", "zone": "security_1", "source": 0},
    "CAM-04": {"name": "Duty Free Area",  "type": "tracking", "zone": "duty_free",  "source": 0},
    "CAM-05": {"name": "Gate D1-D5",      "type": "queue",    "zone": "gates_d",    "source": 0},
}

# ─── Zone Definitions ─────────────────────────────────────
class ZoneType(str, Enum):
    PUBLIC = "public"
    RESTRICTED = "restricted"
    SECURE = "secure"

ZONES = {
    "check_in_a": {"name": "Check-in Hall A", "type": ZoneType.PUBLIC},
    "check_in_b": {"name": "Check-in Hall B", "type": ZoneType.PUBLIC},
    "security_1": {"name": "Security Gate 1", "type": ZoneType.RESTRICTED},
    "duty_free":  {"name": "Duty Free Area",  "type": ZoneType.PUBLIC},
    "gates_d":    {"name": "Gates D1-D5",     "type": ZoneType.SECURE},
}

# ─── Role-Based Access ────────────────────────────────────
class UserRole(str, Enum):
    ADMIN = "admin"
    SECURITY = "security"

# Roles allowed during self-signup. ADMIN is bootstrapped via CLI/seed only.
SELF_SIGNUP_ROLES = {UserRole.ADMIN.value, UserRole.SECURITY.value}
