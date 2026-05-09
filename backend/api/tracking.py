"""Tracking data API routes — MongoDB version."""
from fastapi import APIRouter, Query, Depends
from pydantic import BaseModel
from typing import Optional
from config.db import get_db
from backend.models.schemas import TrackingData
from backend.services.tracking_service import get_tracking_events, log_tracking_event
from backend.security.internal_auth import require_internal_auth

router = APIRouter(prefix="/api/tracking", tags=["tracking"])


# ─── Ingest schema ────────────────────────────────────────
class TrackingIngest(BaseModel):
    track_id: str
    camera_id: str
    zone: str
    event_type: str  # "enter", "exit", "loiter"
    duration_seconds: Optional[float] = None


@router.post("/ingest")
async def ingest_tracking_event(data: TrackingIngest, _auth=Depends(require_internal_auth)):
    """AI tracking module sends events here.
    Protected by X-Internal-Auth header in production.
    Triggers loitering/overstay/re-entry alerts and WS broadcasts."""
    doc = await log_tracking_event(
        track_id=data.track_id,
        camera_id=data.camera_id,
        zone=data.zone,
        event_type=data.event_type,
        duration_seconds=data.duration_seconds,
    )
    return {"status": "ok", "track_id": data.track_id, "event_type": data.event_type}


@router.get("/")
async def list_tracking_events(
    zone: str = Query(None),
    track_id: str = Query(None),
    limit: int = Query(100, le=500),
):
    docs = await get_tracking_events(zone=zone, track_id=track_id, limit=limit)
    return [TrackingData(**doc).model_dump(by_alias=False) for doc in docs]


@router.get("/zones")
async def zone_occupancy():
    """Current occupancy per zone."""
    db = get_db()
    cursor = db.zone_status.find({})
    zones = await cursor.to_list(length=100)
    return {z["zone"]: z.get("current_occupancy", 0) for z in zones}
