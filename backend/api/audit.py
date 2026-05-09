"""Audit log API — admin-only listing with filters."""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from backend.security.deps import require_admin
from backend.services import audit_service

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/")
async def list_audit_logs(
    action: Optional[str] = Query(None, max_length=80),
    actor: Optional[str] = Query(None, max_length=64),
    target_type: Optional[str] = Query(None, max_length=48),
    since: Optional[datetime] = None,
    until: Optional[datetime] = None,
    limit: int = Query(200, ge=1, le=1000),
    session: dict = Depends(require_admin),
):
    docs = await audit_service.list_logs(
        action=action, actor_username=actor, target_type=target_type,
        since=since, until=until, limit=limit,
    )
    return [audit_service.serialize(d) for d in docs]


@router.get("/actions")
async def list_action_codes(session: dict = Depends(require_admin)):
    """Return the canonical list of audit action codes (for frontend filter dropdown)."""
    from backend.models.schemas import AUDIT_ACTIONS
    return {"actions": AUDIT_ACTIONS}
