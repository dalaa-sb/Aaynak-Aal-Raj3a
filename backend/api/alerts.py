"""Alert API routes — MongoDB version with incident lifecycle."""
from typing import Optional, Literal
from fastapi import APIRouter, Query, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from backend.models.schemas import AlertCreate, IncidentStatusUpdate
from backend.services import alert_service, audit_service
from backend.security.deps import get_current_session, require_admin
from config.db import get_db
from datetime import datetime, timezone

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

# Valid filter values for bulk operations — must match the simplified frontend
# workflow plus the legacy values that may still exist in the DB.
_BULK_STATUS_VALUES   = {"all", "acknowledged", "resolved", "dismissed",
                         "new", "active", "investigating"}
_BULK_SEVERITY_VALUES = {"all", "critical", "high", "medium", "low"}


class BulkAlertFilter(BaseModel):
    """Optional filter scope for bulk alert operations.
    Both fields default to 'all' — meaning: apply to every alert in the DB."""
    status:   Optional[str] = Field(default="all", max_length=32)
    severity: Optional[str] = Field(default="all", max_length=16)


@router.get("/")
async def list_alerts(
    limit: int = Query(50, le=200),
    unacknowledged_only: bool = Query(False),
    status: Optional[str] = Query(None, max_length=32),
    severity: Optional[str] = Query(None, max_length=16),
):
    docs = await alert_service.get_alerts(
        limit=limit, unacknowledged_only=unacknowledged_only,
        status=status, severity=severity,
    )
    return [alert_service.serialize_alert(d) for d in docs]


@router.post("/")
async def post_alert(alert: AlertCreate, request: Request):
    """Public endpoint used by the AI module — kept open for the AI process to push alerts.
    In production we'd add an internal API key here."""
    doc = await alert_service.create_alert(alert)
    await audit_service.log_action(
        action="alert.created",
        actor_username="system",
        actor_role="system",
        target_type="alert",
        target_id=str(doc.get("_id")),
        metadata={"severity": alert.severity, "zone": alert.zone, "type": alert.alert_type},
        request=request,
    )
    return alert_service.serialize_alert(doc)


@router.patch("/{alert_id}/acknowledge")
async def ack_alert(
    alert_id: str,
    request: Request,
    session: dict = Depends(get_current_session),
):
    """Legacy acknowledge endpoint — kept for backward compatibility.
    Prefer PATCH /{id}/status with status='acknowledged'."""
    updated = await alert_service.update_status(
        alert_id, "acknowledged", actor=session["username"], notes=None,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Alert not found or transition not allowed")
    await audit_service.log_action(
        action="alert.status_changed",
        actor_username=session["username"], actor_role=session["role"],
        target_type="alert", target_id=alert_id,
        metadata={"new_status": "acknowledged"},
        request=request,
    )
    return alert_service.serialize_alert(updated)


@router.patch("/{alert_id}/status")
async def change_alert_status(
    alert_id: str,
    payload: IncidentStatusUpdate,
    request: Request,
    session: dict = Depends(get_current_session),
):
    """
    Transition an alert through its lifecycle.
    Allowed transitions:
      new           -> acknowledged | investigating | resolved | dismissed
      acknowledged  -> investigating | resolved | dismissed
      investigating -> resolved | dismissed
      resolved/dismissed are terminal.
    """
    updated = await alert_service.update_status(
        alert_id, payload.status, actor=session["username"], notes=payload.notes,
    )
    if updated is None:
        raise HTTPException(
            status_code=409,
            detail="Alert not found or status transition not allowed from current state",
        )
    await audit_service.log_action(
        action="alert.status_changed",
        actor_username=session["username"], actor_role=session["role"],
        target_type="alert", target_id=alert_id,
        metadata={"new_status": payload.status, "has_notes": bool(payload.notes)},
        request=request,
    )
    return alert_service.serialize_alert(updated)


@router.get("/statuses")
async def list_status_codes():
    """Public list of status codes for the frontend filter UI."""
    from backend.models.schemas import INCIDENT_STATUSES
    return {"statuses": INCIDENT_STATUSES}


# ─── BULK ACTIONS (admin only) ───────────────────────────────────────────
def _build_bulk_filter(status: str, severity: str) -> dict:
    """Translate UI filter values into a MongoDB query.

    - status="all"          → no status restriction
    - status="acknowledged" → matches "acknowledged" AND legacy "investigating"
                              (per simplified workflow, those are folded together)
    - status="dismissed"    → only "dismissed"
    - status="resolved"     → only "resolved"
    """
    if status not in _BULK_STATUS_VALUES:
        raise HTTPException(status_code=400, detail="Invalid status filter")
    if severity not in _BULK_SEVERITY_VALUES:
        raise HTTPException(status_code=400, detail="Invalid severity filter")

    q: dict = {}
    if status == "acknowledged":
        # Frontend folds legacy "investigating" rows into "acknowledged".
        q["status"] = {"$in": ["acknowledged", "investigating"]}
    elif status != "all":
        q["status"] = status

    if severity != "all":
        q["severity"] = severity

    return q


@router.patch("/bulk-dismiss")
async def bulk_dismiss_alerts(
    filt: BulkAlertFilter,
    request: Request,
    session: dict = Depends(require_admin),
):
    """Set every alert matching the filter to status='dismissed'.

    Filter scope:
      - {} (defaults: all/all) → every alert in the DB
      - status / severity narrow the scope
    Idempotent: alerts already in 'resolved' or 'dismissed' are excluded
    so we don't 'unfreeze' terminal states.
    """
    db = get_db()
    q = _build_bulk_filter(filt.status or "all", filt.severity or "all")
    # Never re-touch terminal states
    q.setdefault("status", {"$nin": ["resolved", "dismissed"]})
    if isinstance(q.get("status"), dict) and "$nin" not in q["status"]:
        # If we already set status to something specific (e.g. "acknowledged"),
        # the $in already excludes terminal states — leave as is.
        pass

    now = datetime.now(timezone.utc)
    update = {
        "$set": {
            "status": "dismissed",
            "acknowledged": True,           # legacy compatibility
            "updated_at": now,
            "dismissed_at": now,
            "dismissed_by": session["username"],
        },
        "$push": {
            "status_history": {
                "status": "dismissed",
                "actor":  session["username"],
                "ts":     now,
                "notes":  "bulk dismiss",
            }
        },
    }

    result = await db.alerts.update_many(q, update)
    affected = result.modified_count

    await audit_service.log_action(
        action="alert.bulk_dismissed",
        actor_username=session["username"], actor_role=session["role"],
        target_type="alert", target_id=None,
        metadata={"filter": q, "affected": affected},
        request=request,
    )
    return {"affected": affected}


@router.delete("/bulk-delete")
async def bulk_delete_alerts(
    filt: BulkAlertFilter,
    request: Request,
    session: dict = Depends(require_admin),
):
    """Permanently delete every alert matching the filter. Admin only.

    There is no soft-delete — the documents are removed from the DB. The
    audit log is the only record after this action runs.
    """
    db = get_db()
    q = _build_bulk_filter(filt.status or "all", filt.severity or "all")

    # Snapshot the count BEFORE deletion so we can return it to the UI
    affected_count = await db.alerts.count_documents(q)
    if affected_count > 0:
        await db.alerts.delete_many(q)

    await audit_service.log_action(
        action="alert.bulk_deleted",
        actor_username=session["username"], actor_role=session["role"],
        target_type="alert", target_id=None,
        metadata={"filter": q, "affected": affected_count},
        request=request,
    )
    return {"affected": affected_count}
