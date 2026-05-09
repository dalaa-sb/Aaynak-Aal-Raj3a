"""
Settings service.

System-wide thresholds and parameters live in a single document in the
`settings` collection (key="system_thresholds"). Admin-only writes.
Defaults come from the SystemThresholds Pydantic model.
"""
from datetime import datetime, timezone
from typing import Optional
from config.db import get_db
from backend.models.schemas import SystemThresholds

SETTINGS = "settings"
SYSTEM_KEY = "system_thresholds"


async def get_system_thresholds() -> dict:
    """Return current thresholds, falling back to model defaults if not yet stored."""
    db = get_db()
    doc = await db[SETTINGS].find_one({"_id": SYSTEM_KEY})
    if not doc:
        # Return Pydantic-default-validated dict
        return SystemThresholds().model_dump()
    out = {k: v for k, v in doc.items() if k not in ("_id", "updated_at", "updated_by")}
    # Surface metadata as additional fields, not fields of the typed model
    out["_updated_at"] = doc.get("updated_at").isoformat() if hasattr(doc.get("updated_at"), "isoformat") else doc.get("updated_at")
    out["_updated_by"] = doc.get("updated_by")
    return out


async def save_system_thresholds(values: SystemThresholds, *, updated_by: str) -> dict:
    """Persist thresholds. Pydantic has already enforced ge=0 + cross-field rules."""
    db = get_db()
    now = datetime.now(timezone.utc)
    doc = values.model_dump()
    doc["updated_at"] = now
    doc["updated_by"] = updated_by
    await db[SETTINGS].update_one(
        {"_id": SYSTEM_KEY},
        {"$set": doc},
        upsert=True,
    )
    out = dict(doc)
    out["_updated_at"] = now.isoformat()
    out["_updated_by"] = updated_by
    out.pop("updated_at", None)
    out.pop("updated_by", None)
    return out
