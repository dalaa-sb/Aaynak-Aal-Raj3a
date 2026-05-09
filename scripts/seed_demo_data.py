"""
Demo data seeder.

Inserts realistic-looking demo data into MongoDB so the dashboard, charts,
and reports look populated during a demo. Every inserted document is tagged
`demo: True` so it can be cleaned up later with clear_demo_data.py.

Run:
  python scripts/seed_demo_data.py            # insert demo data
  python scripts/seed_demo_data.py --reset    # delete then re-insert
"""
import asyncio
import sys
import random
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Allow running from project root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.db import connect_db, close_db, get_db


# ─── Configurable knobs ──────────────────────────────────
ZONES = [
    {"id": "passport_control",  "name": "Passport Control",  "weight": 1.0},
    {"id": "security_checkpoint","name": "Security Checkpoint","weight": 1.2},
    {"id": "gate_area",          "name": "Gate Area",         "weight": 0.7},
    {"id": "baggage_claim",      "name": "Baggage Claim",     "weight": 0.6},
    {"id": "vip_entrance",       "name": "VIP Entrance",      "weight": 0.3},
    {"id": "customs",            "name": "Customs",           "weight": 0.8},
]
CAMERAS = [f"CAM-{i:02d}" for i in range(1, 9)]
ZONE_TO_CAM = {z["id"]: random.choice(CAMERAS) for z in ZONES}

ALERT_TYPES = [
    ("queue_overflow",        ["medium", "high", "critical"]),
    ("crowd_density",         ["medium", "high"]),
    ("loitering",             ["low", "medium", "high"]),
    ("restricted_zone_entry", ["high", "critical"]),
    ("suspicious_activity",   ["medium", "high"]),
]

ALERT_MESSAGES = {
    "queue_overflow":        "Queue length exceeded threshold",
    "crowd_density":         "Crowd density approaching capacity",
    "loitering":             "Person stationary beyond expected duration",
    "restricted_zone_entry": "Unauthorized entry into restricted zone",
    "suspicious_activity":   "Unusual movement pattern detected",
}

ARABIC_ACTIVITIES = [
    "سلوك مريب",
    "دخول متكرر لمنطقة حساسة",
    "التواجد لفترة طويلة بشكل غير طبيعي",
    "حقيبة متروكة بدون مالك",
    "تجمع غير عادي للأشخاص",
    "محاولة تجاوز نقطة تفتيش",
]

DEMO_TAG = {"demo": True}


def _hour_weight(hour: int) -> float:
    """Airport traffic curve: peaks at morning (07-09) and evening (17-20)."""
    morning = max(0, 1 - abs(hour - 8) / 4)
    evening = max(0, 1 - abs(hour - 18) / 4)
    base = 0.25
    return base + 0.7 * max(morning, evening) + random.uniform(-0.1, 0.1)


async def _seed_queue_snapshots(hours: int = 168):
    """One snapshot per zone per 15-minute interval over the period."""
    db = get_db()
    now = datetime.now(timezone.utc)
    docs = []
    interval = timedelta(minutes=15)
    points_per_zone = (hours * 60) // 15

    for zone in ZONES:
        for i in range(points_per_zone):
            ts = now - interval * (points_per_zone - i)
            w = _hour_weight(ts.hour) * zone["weight"]
            # Realistic airport scale: 30–250 people per zone at peak.
            # Beirut RHIA handles ~8–10k passengers/day; a busy security
            # checkpoint queue can exceed 200 people; passport control 50–150.
            person_count = max(0, int(180 * w + random.gauss(0, 18)))
            density = round(min(1.0, person_count / 250), 2)
            # Wait time: ~15s per person being processed in serial,
            # plus randomness. 200 people ≈ 25–35 min at security.
            wait = round(person_count * 0.18 + random.uniform(-3, 3), 1)

            docs.append({
                "camera_id": ZONE_TO_CAM[zone["id"]],
                "zone": zone["id"],
                "person_count": person_count,
                "density": density,
                "estimated_wait_minutes": max(0, wait),
                "timestamp": ts,
                **DEMO_TAG,
            })

    if docs:
        await db.queue_snapshots.insert_many(docs)
    return len(docs)


async def _seed_alerts(hours: int = 168, count: int = 80):
    db = get_db()
    now = datetime.now(timezone.utc)
    docs = []

    for _ in range(count):
        zone = random.choice(ZONES)
        alert_type, severities = random.choice(ALERT_TYPES)
        severity = random.choice(severities)
        # Bias timestamps toward recent hours
        offset_hours = random.triangular(0, hours, hours / 4)
        created = now - timedelta(hours=offset_hours, minutes=random.randint(0, 59))

        # Realistic lifecycle distribution: 30% new, 25% acknowledged, 15% investigating, 25% resolved, 5% dismissed
        r = random.random()
        if r < 0.30:
            status = "new"; ack = False; ack_at = None; inv_at = None; res_at = None; res_notes = None
        elif r < 0.55:
            status = "acknowledged"; ack = True
            ack_at = created + timedelta(minutes=random.randint(2, 30))
            inv_at = None; res_at = None; res_notes = None
        elif r < 0.70:
            status = "investigating"; ack = True
            ack_at = created + timedelta(minutes=random.randint(2, 15))
            inv_at = ack_at + timedelta(minutes=random.randint(3, 20))
            res_at = None; res_notes = None
        elif r < 0.95:
            status = "resolved"; ack = True
            ack_at = created + timedelta(minutes=random.randint(2, 15))
            inv_at = ack_at + timedelta(minutes=random.randint(3, 20))
            res_at = inv_at + timedelta(minutes=random.randint(5, 40))
            res_notes = "Resolved by on-duty officer."
        else:
            status = "dismissed"; ack = True
            ack_at = created + timedelta(minutes=random.randint(1, 10))
            inv_at = None
            res_at = ack_at + timedelta(minutes=random.randint(1, 10))
            res_notes = "False positive."

        history = [{"status": "new", "by": "system", "at": created, "notes": None}]
        if status != "new":
            if ack_at:
                history.append({"status": "acknowledged", "by": "demo_officer", "at": ack_at, "notes": None})
            if inv_at:
                history.append({"status": "investigating", "by": "demo_officer", "at": inv_at, "notes": None})
            if res_at:
                history.append({"status": status, "by": "demo_officer", "at": res_at, "notes": res_notes})

        docs.append({
            "camera_id": ZONE_TO_CAM[zone["id"]],
            "zone": zone["id"],
            "alert_type": alert_type,
            "severity": severity,
            "message": ALERT_MESSAGES[alert_type],
            "value": round(random.uniform(0.5, 1.0), 2),
            "acknowledged": ack,
            "status": status,
            "status_history": history,
            "assigned_to": None,
            "acknowledged_at": ack_at,
            "investigating_at": inv_at,
            "resolved_at": res_at,
            "resolution_notes": res_notes,
            "created_at": created,
            **DEMO_TAG,
        })

    if docs:
        await db.alerts.insert_many(docs)
    return len(docs)


async def _seed_suspicious(hours: int = 168, count: int = 18):
    db = get_db()
    now = datetime.now(timezone.utc)
    docs = []
    for _ in range(count):
        zone = random.choice(ZONES)
        offset_hours = random.uniform(0, hours)
        created = now - timedelta(hours=offset_hours)
        docs.append({
            "camera_id": ZONE_TO_CAM[zone["id"]],
            "zone": zone["id"],
            "activity_type": random.choice(ARABIC_ACTIVITIES),
            "notes": random.choice([None, "Forwarded to supervisor for review.", "Cleared after follow-up."]),
            "severity": random.choice(["medium", "high", "critical"]),
            "reported_by": "demo_officer",
            "reporter_role": "security",
            "acknowledged": False,
            "created_at": created,
            **DEMO_TAG,
        })
    if docs:
        await db.suspicious_reports.insert_many(docs)
    return len(docs)


async def _seed_tracking(hours: int = 24, count: int = 60):
    db = get_db()
    now = datetime.now(timezone.utc)
    docs = []
    for i in range(count):
        zone = random.choice(ZONES)
        offset_hours = random.uniform(0, hours)
        ts = now - timedelta(hours=offset_hours)
        docs.append({
            "track_id": f"trk_{i:04d}",
            "camera_id": ZONE_TO_CAM[zone["id"]],
            "zone": zone["id"],
            "event_type": random.choice(["enter", "exit", "loiter"]),
            "duration_seconds": round(random.uniform(5, 600), 1),
            "timestamp": ts,
            **DEMO_TAG,
        })
    if docs:
        await db.tracking_events.insert_many(docs)
    return len(docs)


async def _seed_zone_status():
    db = get_db()
    for zone in ZONES:
        existing = await db.zone_status.find_one({"zone": zone["id"]})
        # Compute current occupancy from latest queue snapshot
        latest = await db.queue_snapshots.find_one(
            {"zone": zone["id"]}, sort=[("timestamp", -1)]
        )
        occ = (latest or {}).get("person_count", 0)
        wait = (latest or {}).get("estimated_wait_minutes", 0.0)
        # Status thresholds aligned with realistic airport occupancy
        if occ > 200:
            status_label = "critical"
        elif occ > 100:
            status_label = "warning"
        else:
            status_label = "normal"

        update_doc = {
            "zone": zone["id"],
            "zone_type": "public",
            "current_occupancy": occ,
            "avg_wait_minutes": wait,
            "status": status_label,
            "updated_at": datetime.now(timezone.utc),
        }
        if existing:
            await db.zone_status.update_one(
                {"zone": zone["id"]}, {"$set": update_doc}
            )
        else:
            await db.zone_status.insert_one({**update_doc, **DEMO_TAG})


async def _wipe_demo():
    db = get_db()
    n = 0
    for coll in ("alerts", "queue_snapshots", "suspicious_reports", "tracking_events"):
        res = await db[coll].delete_many({"demo": True})
        n += res.deleted_count
    return n


async def main():
    reset = "--reset" in sys.argv

    print("=" * 60)
    print("  AAR — Demo Data Seeder")
    print("=" * 60)
    await connect_db()

    if reset:
        wiped = await _wipe_demo()
        print(f"[reset] removed {wiped} previously-seeded demo documents")

    print("[1/4] queue snapshots...", end=" ", flush=True)
    n = await _seed_queue_snapshots(hours=168)
    print(f"{n} inserted")

    print("[2/4] alerts...", end=" ", flush=True)
    n = await _seed_alerts(hours=168, count=80)
    print(f"{n} inserted")

    print("[3/4] suspicious activity reports...", end=" ", flush=True)
    n = await _seed_suspicious(hours=168, count=18)
    print(f"{n} inserted")

    print("[4/4] tracking events...", end=" ", flush=True)
    n = await _seed_tracking(hours=24, count=60)
    print(f"{n} inserted")

    await _seed_zone_status()
    print()
    print("✅ Demo data seeded. Open the dashboard or generate a report to see results.")
    print()
    print("Tip: run with --reset to clear and re-seed without duplicates.")
    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
