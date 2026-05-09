"""
Settings API.

GET  /api/settings              — any authenticated user can read current thresholds
                                  (the AI module and security operators need them)
PATCH /api/settings/thresholds  — admin only: update system thresholds
                                  Pydantic enforces ge=0, range bounds, and cross-field rules.
"""
from fastapi import APIRouter, Depends, Request
from backend.models.schemas import SystemThresholds
from backend.security.deps import get_current_session, require_admin
from backend.security.rate_limit import limiter
from backend.services import settings_service, audit_service

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/")
async def read_settings(session: dict = Depends(get_current_session)):
    """Return current system thresholds. Read access for any authenticated user."""
    return await settings_service.get_system_thresholds()


@router.patch("/thresholds")
@limiter.limit("20/minute")
async def update_thresholds(
    request: Request,
    payload: SystemThresholds,
    session: dict = Depends(require_admin),
):
    """
    Update system thresholds.
    Pydantic has already enforced:
      - all numeric fields >= 0
      - density values 0..100
      - confidence_threshold 0..1
      - queue_critical >= queue_warning
      - density_critical >= density_warning
    """
    saved = await settings_service.save_system_thresholds(payload, updated_by=session["username"])

    await audit_service.log_action(
        action="settings.changed",
        actor_username=session["username"], actor_role=session["role"],
        target_type="settings", target_id="system_thresholds",
        metadata={"fields": list(payload.model_dump().keys())},
        request=request,
    )
    return saved
