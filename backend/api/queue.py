"""Queue data API routes — MongoDB version."""
from fastapi import APIRouter, Query, Depends
from pydantic import BaseModel
from config.db import get_db
from backend.models.schemas import QueueData
from backend.services.queue_service import get_queue_history, process_queue_data
from backend.security.internal_auth import require_internal_auth

router = APIRouter(prefix="/api/queue", tags=["queue"])


# ─── Ingest schema ────────────────────────────────────────
class QueueIngest(BaseModel):
    camera_id: str
    zone: str
    person_count: int
    density: float


@router.post("/ingest")
async def ingest_queue_data(data: QueueIngest, _auth=Depends(require_internal_auth)):
    """AI module sends real detection results here.
    Protected by X-Internal-Auth header in production.
    This triggers zone_status updates, alert thresholds, and WS broadcasts."""
    snapshot = await process_queue_data(
        camera_id=data.camera_id,
        zone=data.zone,
        person_count=data.person_count,
        density=data.density,
    )
    return {"status": "ok", "person_count": data.person_count, "zone": data.zone}


@router.get("/")
async def list_queue_data(
    zone: str = Query(None),
    hours: int = Query(1, ge=1, le=24),
):
    docs = await get_queue_history(zone=zone, hours=hours)
    return [QueueData(**doc).model_dump(by_alias=False) for doc in docs]


@router.get("/current")
async def current_queue_status():
    """Get current status per zone."""
    db = get_db()
    cursor = db.zone_status.find({})
    zones = await cursor.to_list(length=100)
    return [
        {
            "zone": z.get("zone"),
            "zone_type": z.get("zone_type", "public"),
            "current_occupancy": z.get("current_occupancy", 0),
            "avg_wait_minutes": z.get("avg_wait_minutes", 0),
            "status": z.get("status", "normal"),
        }
        for z in zones
    ]
