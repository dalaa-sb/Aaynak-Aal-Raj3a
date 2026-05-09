"""Dashboard summary endpoint — MongoDB version."""
from fastapi import APIRouter
from config.db import get_db
from backend.models.schemas import AlertOut, QueueData, ZoneStatusOut

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
async def dashboard_summary():
    db = get_db()

    # Active alert count — respects the incident lifecycle: anything in
    # status "new", "acknowledged", or "investigating" counts as active.
    # Resolved/dismissed alerts are excluded. We still support the legacy
    # `acknowledged: false` form for older docs that lack a status field.
    active_alerts = await db.alerts.count_documents({
        "$and": [
            {"$or": [
                {"status": {"$nin": ["resolved", "dismissed"]}},
                {"status": {"$exists": False}, "acknowledged": False},
            ]},
        ]
    })

    # Recent alerts (last 10)
    recent_cursor = db.alerts.find().sort("created_at", -1).limit(10)
    recent_alerts_raw = await recent_cursor.to_list(length=10)
    recent_alerts = [AlertOut(**doc).model_dump(by_alias=False) for doc in recent_alerts_raw]

    # All zone statuses
    zone_cursor = db.zone_status.find()
    zones_raw = await zone_cursor.to_list(length=100)
    zone_statuses = [ZoneStatusOut(**z).model_dump(by_alias=False) for z in zones_raw]

    zones_critical = sum(1 for z in zones_raw if z.get("status") == "critical")
    total_pax = sum(z.get("current_occupancy", 0) for z in zones_raw)
    avg_wait = (
        sum(z.get("avg_wait_minutes", 0) for z in zones_raw) / len(zones_raw)
        if zones_raw else 0
    )

    # Latest queue snapshot per camera using aggregation
    pipeline = [
        {"$sort": {"timestamp": -1}},
        {"$group": {
            "_id": "$camera_id",
            "doc": {"$first": "$$ROOT"},
        }},
        {"$replaceRoot": {"newRoot": "$doc"}},
    ]
    queue_cursor = db.queue_snapshots.aggregate(pipeline)
    queue_raw = await queue_cursor.to_list(length=50)
    queue_data = [QueueData(**q).model_dump(by_alias=False) for q in queue_raw]

    return {
        "total_passengers": total_pax,
        "active_alerts": active_alerts,
        "zones_critical": zones_critical,
        "avg_wait_minutes": round(avg_wait, 1),
        "queue_data": queue_data,
        "recent_alerts": recent_alerts,
        "zone_statuses": zone_statuses,
    }
