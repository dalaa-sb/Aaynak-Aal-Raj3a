"""Queue analytics service — MongoDB version."""
from datetime import datetime, timedelta
from config.db import get_db
from backend.models.schemas import AlertCreate
from backend.services.alert_service import create_alert
from config.settings import QUEUE_LENGTH_WARNING, QUEUE_LENGTH_CRITICAL, CROWD_DENSITY_CRITICAL

ws_manager = None
def set_ws_manager(manager):
    global ws_manager
    ws_manager = manager


async def process_queue_data(camera_id: str, zone: str,
                              person_count: int, density: float) -> dict:
    """Store snapshot, check thresholds, create alerts if needed."""
    db = get_db()
    est_wait = round(person_count * 2.0, 1)

    # Insert snapshot
    snapshot = {
        "camera_id": camera_id,
        "zone": zone,
        "person_count": person_count,
        "density": density,
        "estimated_wait_minutes": est_wait,
        "timestamp": datetime.utcnow(),
    }
    await db.queue_snapshots.insert_one(snapshot)

    # Determine zone status
    if person_count >= QUEUE_LENGTH_CRITICAL:
        status = "critical"
    elif person_count >= QUEUE_LENGTH_WARNING or density >= CROWD_DENSITY_CRITICAL:
        status = "warning"
    else:
        status = "normal"

    # Upsert zone status (update if exists, insert if not)
    await db.zone_status.update_one(
        {"zone": zone},
        {"$set": {
            "current_occupancy": person_count,
            "avg_wait_minutes": est_wait,
            "status": status,
            "updated_at": datetime.utcnow(),
        }},
        upsert=True,
    )

    # Create alerts based on thresholds
    if person_count >= QUEUE_LENGTH_CRITICAL:
        await create_alert(AlertCreate(
            camera_id=camera_id, zone=zone,
            alert_type="queue_critical", severity="critical",
            message=f"🚨 CRITICAL: {person_count} people in queue at {zone}. Open additional counters NOW!",
            value=float(person_count),
        ))
    elif person_count >= QUEUE_LENGTH_WARNING:
        await create_alert(AlertCreate(
            camera_id=camera_id, zone=zone,
            alert_type="queue_warning", severity="medium",
            message=f"⚠️ Queue building: {person_count} people at {zone}. Consider opening more counters.",
            value=float(person_count),
        ))
    elif density >= CROWD_DENSITY_CRITICAL:
        await create_alert(AlertCreate(
            camera_id=camera_id, zone=zone,
            alert_type="density_warning", severity="high",
            message=f"⚠️ High crowd density ({density:.0%}) at {zone}.",
            value=density,
        ))

    # Broadcast queue update via WS
    if ws_manager:
        await ws_manager.broadcast({
            "type": "queue_update",
            "data": {
                "camera_id": camera_id, "zone": zone,
                "person_count": person_count, "density": round(density, 3),
                "estimated_wait_minutes": est_wait,
                "timestamp": datetime.utcnow().isoformat(),
            }
        })

    return snapshot


async def get_queue_history(zone: str = None, hours: int = 1) -> list:
    """Get queue snapshots from the last N hours."""
    db = get_db()
    cutoff = datetime.utcnow() - timedelta(hours=hours)

    query = {"timestamp": {"$gte": cutoff}}
    if zone:
        query["zone"] = zone

    cursor = db.queue_snapshots.find(query).sort("timestamp", -1)
    return await cursor.to_list(length=500)
