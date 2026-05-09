"""
MongoDB connection using Motor (async driver).
Single client reused across the entire app — no reconnect per request.

Usage in any file:
    from config.db import get_db
    db = get_db()
    result = await db.alerts.find_one({"_id": ...})
"""
from motor.motor_asyncio import AsyncIOMotorClient
from config.settings import MONGO_URL, MONGO_DB_NAME

# ─── Single global client (created once, reused forever) ──
_client: AsyncIOMotorClient = None
_db = None


async def connect_db():
    """Call once at startup. Creates the Motor client."""
    global _client, _db
    _client = AsyncIOMotorClient(MONGO_URL)
    _db = _client[MONGO_DB_NAME]

    # Verify connection
    await _client.admin.command("ping")
    # Mask credentials in log output
    import re
    safe_url = re.sub(r"://[^@]+@", "://***:***@", MONGO_URL)
    print(f"✅ MongoDB connected: {safe_url} → db={MONGO_DB_NAME}")

    # Create indexes for fast queries
    await _create_indexes()


async def close_db():
    """Call once at shutdown."""
    global _client
    if _client:
        _client.close()
        print("🛬 MongoDB connection closed")


def get_db():
    """Returns the database instance. No async needed — it's already connected."""
    return _db


async def _create_indexes():
    """Create MongoDB indexes for performance."""
    db = get_db()

    # Alerts: sort by created_at, filter by acknowledged
    await db.alerts.create_index([("created_at", -1)])
    await db.alerts.create_index("acknowledged")
    await db.alerts.create_index("camera_id")

    # Queue snapshots: sort by timestamp, filter by zone/camera
    await db.queue_snapshots.create_index([("timestamp", -1)])
    await db.queue_snapshots.create_index("camera_id")
    await db.queue_snapshots.create_index("zone")

    # Tracking events: sort by timestamp, filter by track_id/zone
    await db.tracking_events.create_index([("timestamp", -1)])
    await db.tracking_events.create_index("track_id")
    await db.tracking_events.create_index("zone")

    # Zone status: unique zone
    await db.zone_status.create_index("zone", unique=True)

    print("✅ MongoDB indexes created")
