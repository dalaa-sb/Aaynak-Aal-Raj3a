"""Face tracking service — MongoDB version."""
from datetime import datetime, timedelta
from config.db import get_db
from backend.models.schemas import AlertCreate
from backend.services.alert_service import create_alert
from config.settings import MAX_AREA_STAY_MINUTES, RESTRICTED_ZONE_RE_ENTRY_LIMIT, SUSPICIOUS_LOITER_MINUTES

ws_manager = None
def set_ws_manager(manager):
    global ws_manager
    ws_manager = manager


async def log_tracking_event(track_id: str, camera_id: str,
                              zone: str, event_type: str,
                              duration_seconds: float = None) -> dict:
    """Log a tracking event and check for suspicious behavior."""
    db = get_db()

    doc = {
        "track_id": track_id,
        "camera_id": camera_id,
        "zone": zone,
        "event_type": event_type,
        "duration_seconds": duration_seconds,
        "timestamp": datetime.utcnow(),
    }
    await db.tracking_events.insert_one(doc)

    # ─── Check loitering ──────────────────────────────────
    if duration_seconds and duration_seconds / 60 > SUSPICIOUS_LOITER_MINUTES:
        await create_alert(AlertCreate(
            camera_id=camera_id, zone=zone,
            alert_type="loitering", severity="high",
            message=f"🔍 Person (ID:{track_id[:8]}) loitering for {duration_seconds/60:.0f}min in {zone}",
            value=duration_seconds / 60,
        ))

    # ─── Check overstay ───────────────────────────────────
    if duration_seconds and duration_seconds / 60 > MAX_AREA_STAY_MINUTES:
        await create_alert(AlertCreate(
            camera_id=camera_id, zone=zone,
            alert_type="overstay", severity="critical",
            message=f"🚨 Person (ID:{track_id[:8]}) exceeded max stay ({duration_seconds/60:.0f}min) in {zone}",
            value=duration_seconds / 60,
        ))

    # ─── Check re-entry into restricted zones ─────────────
    if event_type == "enter":
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        entry_count = await db.tracking_events.count_documents({
            "track_id": track_id,
            "zone": zone,
            "event_type": "enter",
            "timestamp": {"$gte": one_hour_ago},
        })

        if entry_count >= RESTRICTED_ZONE_RE_ENTRY_LIMIT:
            await create_alert(AlertCreate(
                camera_id=camera_id, zone=zone,
                alert_type="re_entry", severity="high",
                message=f"⚠️ Person (ID:{track_id[:8]}) entered {zone} {entry_count} times in 1 hour",
                value=float(entry_count),
            ))

    # Broadcast
    if ws_manager:
        await ws_manager.broadcast({
            "type": "tracking_event",
            "data": {
                "track_id": track_id, "camera_id": camera_id,
                "zone": zone, "event_type": event_type,
                "duration_seconds": duration_seconds,
                "timestamp": datetime.utcnow().isoformat(),
            }
        })

    return doc


async def get_tracking_events(zone: str = None, track_id: str = None, limit: int = 100) -> list:
    """Fetch tracking events with optional filters."""
    db = get_db()

    query = {}
    if zone:
        query["zone"] = zone
    if track_id:
        query["track_id"] = track_id

    cursor = db.tracking_events.find(query).sort("timestamp", -1).limit(limit)
    return await cursor.to_list(length=limit)
