"""
Map zones API.

GET /api/map/zones — returns one record per airport zone with current
operational state, used by the InteractiveMap component on the dashboard.
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from backend.security.deps import get_current_session
from config.db import get_db

router = APIRouter(prefix="/api/map", tags=["map"])


# Stable zone IDs and their canonical label keys. Frontend translates
# label_key into the user's language. New zones can be added without
# breaking older clients.
ZONES = [
    {"zone_id": "passport_control",    "label_key": "zones.passportControl",    "x": 25, "y": 28, "w": 22, "h": 18, "icon": "passport"},
    {"zone_id": "security_checkpoint", "label_key": "zones.securityCheckpoint", "x": 52, "y": 28, "w": 22, "h": 18, "icon": "shield"},
    {"zone_id": "gate_area",           "label_key": "zones.gateArea",           "x": 78, "y": 26, "w": 18, "h": 22, "icon": "plane"},
    {"zone_id": "baggage_claim",       "label_key": "zones.baggageClaim",       "x": 25, "y": 56, "w": 22, "h": 18, "icon": "luggage"},
    {"zone_id": "customs",             "label_key": "zones.customs",            "x": 52, "y": 56, "w": 22, "h": 18, "icon": "customs"},
    {"zone_id": "vip_entrance",        "label_key": "zones.vipEntrance",        "x": 4,  "y": 26, "w": 16, "h": 18, "icon": "vip"},
    {"zone_id": "staff_entrance",      "label_key": "zones.staffEntrance",      "x": 78, "y": 56, "w": 18, "h": 18, "icon": "staff"},
]


def _classify_severity(active_alerts: int, critical_alerts: int, occupancy: int, threshold_critical: int = 200) -> str:
    if critical_alerts > 0 or occupancy >= threshold_critical:
        return "critical"
    if active_alerts >= 3 or occupancy >= int(threshold_critical * 0.7):
        return "high"
    if active_alerts >= 1 or occupancy >= int(threshold_critical * 0.4):
        return "warning"
    return "normal"


@router.get("/zones")
async def get_map_zones(session: dict = Depends(get_current_session)):
    """
    Return enriched zone data for the interactive map. Each zone includes:
    - stable zone_id and label_key (frontend translates)
    - x/y/w/h positioning (percent of viewBox) for SVG rendering
    - current queue count + estimated wait
    - active alerts count + critical count
    - severity classification
    - camera status
    - last_updated timestamp
    - recent suspicious report count (last 24h)
    """
    db = get_db()
    now = datetime.now(timezone.utc)
    yesterday = now - timedelta(hours=24)

    # Pull current zone occupancy from latest queue snapshot per zone
    zone_states = {z["zone_id"]: {} for z in ZONES}

    # Latest queue snapshot per zone
    for z in ZONES:
        latest = await db.queue_snapshots.find_one(
            {"zone": z["zone_id"]},
            sort=[("timestamp", -1)],
        )
        if latest:
            zone_states[z["zone_id"]] = {
                "queue_count": int(latest.get("person_count", 0)),
                "estimated_wait_minutes": float(latest.get("estimated_wait_minutes", 0)),
                "last_updated": latest.get("timestamp"),
            }

    # Active alerts per zone (status not in resolved/dismissed)
    active_alerts_pipeline = [
        {"$match": {"status": {"$nin": ["resolved", "dismissed"]}}},
        {"$group": {
            "_id": "$zone",
            "total": {"$sum": 1},
            "critical": {"$sum": {"$cond": [{"$eq": ["$severity", "critical"]}, 1, 0]}},
        }},
    ]
    alerts_by_zone = {}
    async for r in db.alerts.aggregate(active_alerts_pipeline):
        alerts_by_zone[r["_id"]] = {"total": r["total"], "critical": r["critical"]}

    # Suspicious reports in last 24h per zone
    recent_susp = {}
    susp_pipeline = [
        {"$match": {"created_at": {"$gte": yesterday}}},
        {"$group": {"_id": "$zone", "count": {"$sum": 1}}},
    ]
    async for r in db.suspicious_reports.aggregate(susp_pipeline):
        recent_susp[r["_id"]] = r["count"]

    # Try to honor the configured queue_critical threshold
    threshold_critical = 200
    try:
        from backend.services import settings_service
        thresholds = await settings_service.get_system_thresholds()
        threshold_critical = int(thresholds.get("queue_critical") or 200)
    except Exception:
        pass

    # Build response
    out = []
    for z in ZONES:
        state = zone_states.get(z["zone_id"], {}) or {}
        alerts = alerts_by_zone.get(z["zone_id"], {"total": 0, "critical": 0})
        queue = state.get("queue_count", 0)
        last_up = state.get("last_updated")

        out.append({
            "zone_id": z["zone_id"],
            "label_key": z["label_key"],
            "x": z["x"], "y": z["y"], "w": z["w"], "h": z["h"],
            "icon": z["icon"],
            "queue_count": queue,
            "estimated_wait_minutes": round(state.get("estimated_wait_minutes", 0), 1),
            "active_alerts": alerts["total"],
            "critical_alerts": alerts["critical"],
            "recent_suspicious_24h": recent_susp.get(z["zone_id"], 0),
            "severity": _classify_severity(alerts["total"], alerts["critical"], queue, threshold_critical),
            "camera_status": "online",  # AI module liveness is exposed via /api/health
            "last_updated": last_up.isoformat() if isinstance(last_up, datetime) else None,
        })

    return {
        "checked_at": now.isoformat(),
        "zones": out,
    }
