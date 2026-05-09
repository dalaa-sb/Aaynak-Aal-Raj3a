"""
Pydantic schemas — strict validation prevents NoSQL injection at the schema layer.
All string fields are constrained, length-limited, and pattern-checked.
"""
import re
from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, EmailStr, field_validator, ConfigDict
from bson import ObjectId


# ─── Helpers ──────────────────────────────────────────────
USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_.\-]{3,32}$")

def _strip_dangerous(v: str) -> str:
    """Strip control chars, null bytes, and obvious script tags from text."""
    if not isinstance(v, str):
        raise ValueError("Must be a string")
    # Remove null bytes and control chars (keep newlines for descriptions)
    v = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", v)
    return v.strip()


# ─── ObjectId helper ──────────────────────────────────────
class MongoBaseModel(BaseModel):
    id: Optional[str] = Field(None, alias="_id")

    @field_validator("id", mode="before")
    @classmethod
    def convert_objectid(cls, v):
        if isinstance(v, ObjectId):
            return str(v)
        return str(v) if v else None

    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str, datetime: lambda v: v.isoformat()},
    )


# ─── Auth ─────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=1, max_length=200)

    @field_validator("username")
    @classmethod
    def validate_username(cls, v):
        v = _strip_dangerous(v)
        # Allow username OR email at login
        if "@" in v:
            return v.lower()  # email
        if not USERNAME_PATTERN.match(v):
            raise ValueError("Invalid username format")
        return v.lower()


class LoginResponse(BaseModel):
    token: str
    role: str
    username: str
    full_name: Optional[str] = None
    email_verified: bool = False
    id_verified: bool = False
    expires_in: int = 3600
    language: Optional[Literal["en", "ar", "fr"]] = None  # null if never set


class SignupRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=32)
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=80)
    email: EmailStr
    role: Literal["admin", "security"]
    language: Optional[Literal["en", "ar", "fr"]] = None  # optional, applied at first login

    @field_validator("username")
    @classmethod
    def vu(cls, v):
        v = _strip_dangerous(v).lower()
        if not USERNAME_PATTERN.match(v):
            raise ValueError("Username may only contain letters, numbers, dot, underscore, hyphen (3-32 chars)")
        return v

    @field_validator("full_name")
    @classmethod
    def vfn(cls, v):
        v = _strip_dangerous(v)
        # Letters (incl. Unicode), spaces, hyphens, apostrophes only
        if not re.match(r"^[\w\s\-'.]+$", v, re.UNICODE):
            raise ValueError("Full name contains invalid characters")
        return v

    @field_validator("password")
    @classmethod
    def vpw(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        # Require at least one letter and one digit
        if not re.search(r"[A-Za-z]", v) or not re.search(r"[0-9]", v):
            raise ValueError("Password must contain letters and digits")
        return v


class SignupResponse(BaseModel):
    success: bool
    message: str
    username: str
    role: str
    requires_verification: bool = True


class VerifyEmailRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^[0-9]{6}$")

    @field_validator("username")
    @classmethod
    def vu(cls, v):
        v = _strip_dangerous(v).lower()
        if "@" not in v and not USERNAME_PATTERN.match(v):
            raise ValueError("Invalid username")
        return v


class ResendVerificationRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)

    @field_validator("username")
    @classmethod
    def vu(cls, v):
        v = _strip_dangerous(v).lower()
        if "@" not in v and not USERNAME_PATTERN.match(v):
            raise ValueError("Invalid username")
        return v


# ─── Password Reset (token-based) ─────────────────────────
class ForgotPasswordRequest(BaseModel):
    """User requests a reset token by giving username/email — admin must approve in admin flow."""
    identifier: str = Field(..., min_length=3, max_length=64)

    @field_validator("identifier")
    @classmethod
    def vi(cls, v):
        return _strip_dangerous(v).lower()


class AdminResetRequest(BaseModel):
    """Admin issues a reset token for a target user."""
    target_username: str = Field(..., min_length=3, max_length=64)

    @field_validator("target_username")
    @classmethod
    def vt(cls, v):
        return _strip_dangerous(v).lower()


class ConfirmResetRequest(BaseModel):
    """Confirm reset using token + new password."""
    reset_token: str = Field(..., min_length=20, max_length=1000)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def vpw(cls, v):
        if not re.search(r"[A-Za-z]", v) or not re.search(r"[0-9]", v):
            raise ValueError("Password must contain letters and digits")
        return v


# ─── User info ────────────────────────────────────────────
class UserInfo(BaseModel):
    username: str
    role: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    email_verified: bool = False
    id_verified: bool = False
    id_image_path: Optional[str] = None  # only exposed to admin
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    last_login: Optional[str] = None


# ─── Alerts ───────────────────────────────────────────────
class AlertCreate(BaseModel):
    camera_id: str = Field(..., min_length=1, max_length=32)
    zone: str = Field(..., min_length=1, max_length=32)
    alert_type: str = Field(..., min_length=1, max_length=64)
    severity: Literal["low", "medium", "high", "critical"]
    message: str = Field(..., min_length=1, max_length=500)
    value: Optional[float] = None

    @field_validator("camera_id", "zone", "alert_type")
    @classmethod
    def alphanum(cls, v):
        v = _strip_dangerous(v)
        if not re.match(r"^[A-Za-z0-9_\-]+$", v):
            raise ValueError("Invalid format")
        return v

    @field_validator("message")
    @classmethod
    def vmsg(cls, v):
        return _strip_dangerous(v)


class AlertOut(MongoBaseModel):
    camera_id: str
    zone: str
    alert_type: str
    severity: str
    message: str
    value: Optional[float] = None
    acknowledged: bool = False
    created_at: datetime


# ─── Queue ────────────────────────────────────────────────
class QueueData(MongoBaseModel):
    camera_id: str
    zone: str
    person_count: int
    density: float
    estimated_wait_minutes: float
    timestamp: datetime


# ─── Tracking ─────────────────────────────────────────────
class TrackingData(MongoBaseModel):
    track_id: str
    camera_id: str
    zone: str
    event_type: str
    duration_seconds: Optional[float] = None
    timestamp: datetime


# ─── Zone ─────────────────────────────────────────────────
class ZoneStatusOut(MongoBaseModel):
    zone: str
    zone_type: str
    current_occupancy: int = 0
    avg_wait_minutes: float = 0.0
    status: str = "normal"
    updated_at: datetime


# ─── Dashboard Summary ───────────────────────────────────
class DashboardSummary(BaseModel):
    total_passengers: int
    active_alerts: int
    zones_critical: int
    avg_wait_minutes: float
    queue_data: List[QueueData]
    recent_alerts: List[AlertOut]
    zone_statuses: List[ZoneStatusOut]


# ─── Suspicious Activity ─────────────────────────────────
SUSPICIOUS_ACTIVITY_TYPES = [
    "سلوك مريب",
    "دخول متكرر لمنطقة حساسة",
    "التواجد لفترة طويلة بشكل غير طبيعي",
    "حقيبة متروكة بدون مالك",
    "تجمع غير عادي للأشخاص",
    "محاولة تجاوز نقطة تفتيش",
    "تصوير غير مصرح به",
    "مشاجرة أو سلوك عدائي",
    "أخرى",
]


class SuspiciousReportCreate(BaseModel):
    camera_id: str = Field(..., min_length=1, max_length=32)
    zone: str = Field(..., min_length=1, max_length=32)
    activity_type: str = Field(..., min_length=1, max_length=80)
    notes: Optional[str] = Field(None, max_length=500)
    severity: Literal["low", "medium", "high", "critical"] = "high"

    @field_validator("camera_id", "zone")
    @classmethod
    def alphanum(cls, v):
        v = _strip_dangerous(v)
        if not re.match(r"^[A-Za-z0-9_\-]+$", v):
            raise ValueError("Invalid format")
        return v

    @field_validator("activity_type")
    @classmethod
    def vat(cls, v):
        return _strip_dangerous(v)

    @field_validator("notes")
    @classmethod
    def vn(cls, v):
        return _strip_dangerous(v) if v else None


# ─── Reports ─────────────────────────────────────────────
class ReportGenerateRequest(BaseModel):
    report_type: Literal["daily", "weekly", "monthly", "custom"] = "daily"
    period_hours: Optional[int] = Field(None, ge=1, le=720)


# ─── Incident Lifecycle ──────────────────────────────────
INCIDENT_STATUSES = ["new", "acknowledged", "investigating", "resolved", "dismissed"]

# Allowed transitions: from -> set of allowed next states
INCIDENT_TRANSITIONS = {
    "new":            {"acknowledged", "investigating", "resolved", "dismissed"},
    "acknowledged":   {"investigating", "resolved", "dismissed"},
    "investigating":  {"resolved", "dismissed"},
    "resolved":       set(),  # terminal
    "dismissed":      set(),  # terminal
}


class IncidentStatusUpdate(BaseModel):
    """Request payload to change an alert/incident's lifecycle status."""
    status: Literal["new", "acknowledged", "investigating", "resolved", "dismissed"]
    notes: Optional[str] = Field(None, max_length=1000)

    @field_validator("notes")
    @classmethod
    def vn(cls, v):
        return _strip_dangerous(v) if v else None


# ─── Audit Log ───────────────────────────────────────────
# Stable action codes used across the system. Display labels resolved on frontend per locale.
AUDIT_ACTIONS = [
    "user.login.success",
    "user.login.failure",
    "user.signup",
    "user.email_verify",
    "user.id_verify",
    "user.deleted",
    "user.password_reset_issued",
    "user.password_reset_used",
    "user.profile_updated",
    "alert.created",
    "alert.status_changed",
    "alert.bulk_dismissed",
    "alert.bulk_deleted",
    "suspicious_report.filed",
    "report.generated",
    "report.downloaded",
    "report.deleted",
    "settings.changed",
]


class AuditLogOut(MongoBaseModel):
    action: str
    actor_username: Optional[str] = None
    actor_role: Optional[str] = None
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    metadata: Optional[dict] = None
    created_at: datetime


# ─── Profile Editing (any authenticated user, self only) ─
SUPPORTED_LANGUAGES = ["en", "ar", "fr"]


class ProfileUpdateRequest(BaseModel):
    """
    Fields a user is allowed to edit on themselves.
    Email change is intentionally excluded — it would require re-verification.
    Role, password, verification flags, lock status are NOT editable here.
    """
    full_name: Optional[str] = Field(None, min_length=2, max_length=80)
    phone: Optional[str] = Field(None, max_length=24)
    language: Optional[Literal["en", "ar", "fr"]] = None

    @field_validator("full_name")
    @classmethod
    def vfn(cls, v):
        return _strip_dangerous(v) if v else v

    @field_validator("phone")
    @classmethod
    def vph(cls, v):
        if v is None or v == "":
            return None
        v = _strip_dangerous(v)
        # Allow digits, +, -, space, parentheses; reasonable international format
        if not re.match(r"^[\d+\-\s()]{4,24}$", v):
            raise ValueError("Invalid phone format")
        return v


# ─── System Settings (admin-only thresholds) ─────────────
class SystemThresholds(BaseModel):
    """
    Thresholds used by the AI module and dashboard severity classification.
    All fields ge=0 — negative values are nonsensical.
    """
    queue_warning:    int = Field(100, ge=0, le=10000, description="People count → warning")
    queue_critical:   int = Field(200, ge=0, le=10000, description="People count → critical")
    density_warning:  int = Field(60, ge=0, le=100,   description="Density % → warning")
    density_critical: int = Field(85, ge=0, le=100,   description="Density % → critical")
    loiter_minutes:   int = Field(15, ge=0, le=1440,  description="Loiter minutes before alert")
    max_stay_minutes: int = Field(30, ge=0, le=1440,  description="Max area stay before alert")
    confidence_threshold: float = Field(0.5, ge=0.0, le=1.0, description="AI detection confidence floor")

    @field_validator("queue_critical")
    @classmethod
    def critical_gt_warning(cls, v, info):
        warn = info.data.get("queue_warning")
        if warn is not None and v < warn:
            raise ValueError("queue_critical must be >= queue_warning")
        return v

    @field_validator("density_critical")
    @classmethod
    def density_critical_gt_warning(cls, v, info):
        warn = info.data.get("density_warning")
        if warn is not None and v < warn:
            raise ValueError("density_critical must be >= density_warning")
        return v
