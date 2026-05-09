"""
Clear demo data.

Removes only documents tagged `demo: True` from the alerts, queue_snapshots,
suspicious_reports, and tracking_events collections. User accounts and
real (non-demo) data are not touched.

Run: python scripts/clear_demo_data.py
"""
import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.db import connect_db, close_db, get_db


async def main():
    print("Clearing demo-tagged data only (real data preserved)...")
    await connect_db()
    db = get_db()

    total = 0
    for coll in ("alerts", "queue_snapshots", "suspicious_reports", "tracking_events"):
        res = await db[coll].delete_many({"demo": True})
        print(f"  {coll}: removed {res.deleted_count}")
        total += res.deleted_count

    print(f"\n✅ Removed {total} demo documents.")
    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
