"""
Alert service — MongoDB version with incident lifecycle.

Each alert has both:
- legacy `acknowledged` boolean (preserved for compatibility)
- new `status` field with full lifecycle (new -> acknowledged -> investigating -> resolved/dismissed)
- `status_history` list of {status, by, at, notes} for an audit trail per incident
"""
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from config.db import get_db
from backend.models.schemas import AlertCreate, INCIDENT_TRANSITIONS

# Global WebSocket manager reference (set at startup)
ws_manager = None


def set_ws_manager(manager):
    global ws_manager
    ws_manager = manager


async def create_alert(alert_data: AlertCreate) -> dict:
    """Insert alert into MongoDB and broadcast via WebSocket."""
    db = get_db()
    now = datetime.now(timezone.utc)

    doc = {
        "camera_id": alert_data.camera_id,
        "zone": alert_data.zone,
        "alert_type": alert_data.alert_type,
        "severity": alert_data.severity,
        "message": alert_data.message,
        "value": alert_data.value,
        "acknowledged": False,
        "status": "new",
        "status_history": [{"status": "new", "by": "system", "at": now, "notes": None}],
        "assigned_to": None,
        "acknowledged_at": None,
        "investigating_at": None,
        "resolved_at": None,
        "resolution_notes": None,
        "created_at": now,
    }
    result = await db.alerts.insert_one(doc)
    doc["_id"] = result.inserted_id

    if ws_manager:
        try:
            await ws_manager.broadcast({
                "type": "alert",
                "data": {
                    "id": str(result.inserted_id),
                    "camera_id": doc["camera_id"],
                    "zone": doc["zone"],
                    "alert_type": doc["alert_type"],
                    "severity": doc["severity"],
                    "message": doc["message"],
                    "value": doc["value"],
                    "status": doc["status"],
                    "created_at": doc["created_at"].isoformat(),
                }
            })
        except Exception:
            pass  # Never let broadcast failure block alert creation

    return doc


async def get_alerts(
    limit: int = 50,
    unacknowledged_only: bool = False,
    status: Optional[str] = None,
    severity: Optional[str] = None,
) -> list:
    """Fetch alerts sorted by newest first."""
    db = get_db()
    query = {}
    if unacknowledged_only:
        query["acknowledged"] = False
    if status and isinstance(status, str):
        query["status"] = status
    if severity and isinstance(severity, str):
        query["severity"] = severity

    cursor = db.alerts.find(query).sort("created_at", -1).limit(limit)
    return await cursor.to_list(length=limit)


async def get_alert(alert_id: str) -> Optional[dict]:
    if not isinstance(alert_id, str):
        return None
    try:
        oid = ObjectId(alert_id)
    except Exception:
        return None
    db = get_db()
    return await db.alerts.find_one({"_id": oid})


async def acknowledge_alert(alert_id: str) -> bool:
    """Legacy ack endpoint — sets both `acknowledged` and `status='acknowledged'`."""
    return await update_status(alert_id, "acknowledged", actor="legacy_ack", notes=None) is not None


async def update_status(alert_id: str, new_status: str, *, actor: str, notes: Optional[str] = None) -> Optional[dict]:
    """
    Transition an alert to a new lifecycle status.
    Validates the transition; returns updated doc or None if not allowed/found.
    """
    if new_status not in INCIDENT_TRANSITIONS and new_status != "new":
        return None

    db = get_db()
    try:
        oid = ObjectId(alert_id)
    except Exception:
        return None

    current = await db.alerts.find_one({"_id": oid})
    if not current:
        return None

    cur_status = current.get("status", "new")
    # Allow no-op refresh (e.g., already acknowledged) silently
    if cur_status == new_status:
        return current

    allowed = INCIDENT_TRANSITIONS.get(cur_status, set())
    if new_status not in allowed:
        return None  # Caller should return 409 Conflict

    now = datetime.now(timezone.utc)
    history_entry = {"status": new_status, "by": actor, "at": now, "notes": notes}

    update = {
        "status": new_status,
        "acknowledged": new_status in ("acknowledged", "investigating", "resolved", "dismissed"),
    }
    if new_status == "acknowledged":
        update["acknowledged_at"] = now
    elif new_status == "investigating":
        update["investigating_at"] = now
        if not current.get("acknowledged_at"):
            update["acknowledged_at"] = now  # implies ack
    elif new_status == "resolved":
        update["resolved_at"] = now
        if notes:
            update["resolution_notes"] = notes
        if not current.get("acknowledged_at"):
            update["acknowledged_at"] = now
    elif new_status == "dismissed":
        update["resolved_at"] = now
        if notes:
            update["resolution_notes"] = notes
        if not current.get("acknowledged_at"):
            update["acknowledged_at"] = now

    await db.alerts.update_one(
        {"_id": oid},
        {"$set": update, "$push": {"status_history": history_entry}},
    )

    # Broadcast status change
    if ws_manager:
        try:
            await ws_manager.broadcast({
                "type": "alert_status",
                "data": {"id": alert_id, "status": new_status, "by": actor},
            })
        except Exception:
            pass

    return await db.alerts.find_one({"_id": oid})


def serialize_alert(doc: dict) -> dict:
    """Convert mongo alert doc to JSON-safe dict including history timestamps."""
    if not doc:
        return {}
    out = {
        "id": str(doc.get("_id", "")),
        "camera_id": doc.get("camera_id"),
        "zone": doc.get("zone"),
        "alert_type": doc.get("alert_type"),
        "severity": doc.get("severity"),
        "message": doc.get("message"),
        "value": doc.get("value"),
        "acknowledged": doc.get("acknowledged", False),
        "status": doc.get("status", "new"),
        "assigned_to": doc.get("assigned_to"),
        "resolution_notes": doc.get("resolution_notes"),
    }
    for f in ("created_at", "acknowledged_at", "investigating_at", "resolved_at"):
        v = doc.get(f)
        out[f] = v.isoformat() if isinstance(v, datetime) else v
    history = doc.get("status_history") or []
    out["status_history"] = [
        {
            "status": h.get("status"),
            "by": h.get("by"),
            "notes": h.get("notes"),
            "at": h["at"].isoformat() if isinstance(h.get("at"), datetime) else h.get("at"),
        }
        for h in history
    ]
    return out
