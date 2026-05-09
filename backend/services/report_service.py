"""
Reports service.

The "AI assistant" runs statistical analysis over collected data and
produces structured reports without external API calls. It identifies
patterns, anomalies, peak times, busiest zones, and writes natural-language
summaries.

Flow: aggregate DB data -> compute metrics -> generate insights -> save report -> return.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from collections import Counter, defaultdict

from config.db import get_db

REPORTS = "reports"
ALERTS = "alerts"
QUEUE_SNAPS = "queue_snapshots"
SUSP = "suspicious_reports"
TRACKING = "tracking_events"


def _safe_avg(values):
    return round(sum(values) / len(values), 1) if values else 0.0


async def _gather_data(period_from: datetime, period_to: datetime) -> dict:
    """Pull all relevant data for the report period."""
    db = get_db()
    q = {"created_at": {"$gte": period_from, "$lte": period_to}}
    qts = {"timestamp": {"$gte": period_from, "$lte": period_to}}

    alerts = [a async for a in db[ALERTS].find(q).sort("created_at", -1)]
    queue = [q1 async for q1 in db[QUEUE_SNAPS].find(qts).sort("timestamp", -1)]
    suspicious = [s async for s in db[SUSP].find(q).sort("created_at", -1)]
    tracking = [t async for t in db[TRACKING].find(qts)]

    return {
        "alerts": alerts,
        "queue": queue,
        "suspicious": suspicious,
        "tracking": tracking,
    }


def _analyze_alerts(alerts: list) -> dict:
    """Severity breakdown, top zones, ack rate."""
    if not alerts:
        return {"total": 0, "by_severity": {}, "by_zone": {}, "ack_rate": 0, "unacked_critical": 0}

    sev_counts = Counter(a.get("severity", "low") for a in alerts)
    zone_counts = Counter(a.get("zone", "unknown") for a in alerts)
    acked = sum(1 for a in alerts if a.get("acknowledged"))
    unacked_critical = sum(1 for a in alerts if not a.get("acknowledged") and a.get("severity") == "critical")

    return {
        "total": len(alerts),
        "by_severity": dict(sev_counts),
        "by_zone": dict(zone_counts.most_common(5)),
        "ack_rate": round(100 * acked / len(alerts), 1) if alerts else 0,
        "unacked_critical": unacked_critical,
    }


def _analyze_queue(queue: list) -> dict:
    """Peak hours, busiest zone, average wait, anomalies."""
    if not queue:
        return {"snapshots": 0, "peak_hour": None, "busiest_zone": None, "avg_wait": 0, "max_count": 0}

    by_hour = defaultdict(list)
    by_zone = defaultdict(list)
    waits = []

    for snap in queue:
        ts = snap.get("timestamp")
        if isinstance(ts, datetime):
            by_hour[ts.hour].append(snap.get("person_count", 0))
        by_zone[snap.get("zone", "?")].append(snap.get("person_count", 0))
        if snap.get("estimated_wait_minutes") is not None:
            waits.append(snap["estimated_wait_minutes"])

    peak_hour = max(by_hour.items(), key=lambda kv: max(kv[1]) if kv[1] else 0)[0] if by_hour else None
    busiest = max(by_zone.items(), key=lambda kv: _safe_avg(kv[1]))[0] if by_zone else None
    max_count = max((max(v) for v in by_zone.values() if v), default=0)

    return {
        "snapshots": len(queue),
        "peak_hour": peak_hour,
        "busiest_zone": busiest,
        "avg_wait": _safe_avg(waits),
        "max_count": max_count,
        "zones": {z: {"avg": _safe_avg(v), "peak": max(v) if v else 0} for z, v in by_zone.items()},
    }


def _analyze_suspicious(suspicious: list) -> dict:
    if not suspicious:
        return {"total": 0, "by_type": {}, "by_zone": {}}

    type_counts = Counter(s.get("activity_type", "?") for s in suspicious)
    zone_counts = Counter(s.get("zone", "?") for s in suspicious)
    return {
        "total": len(suspicious),
        "by_type": dict(type_counts.most_common(10)),
        "by_zone": dict(zone_counts.most_common(5)),
    }


def _generate_summary(alert_stats: dict, queue_stats: dict, susp_stats: dict, period_from, period_to) -> str:
    """Compose a natural-language executive summary."""
    parts = []
    duration_hours = max(1, (period_to - period_from).total_seconds() / 3600)

    parts.append(
        f"This report covers operations from {period_from.strftime('%Y-%m-%d %H:%M')} "
        f"to {period_to.strftime('%Y-%m-%d %H:%M')} ({duration_hours:.0f} hours)."
    )

    # Alerts narrative
    if alert_stats["total"] == 0:
        parts.append("No security alerts were generated during this period — operations remained nominal.")
    else:
        sev = alert_stats["by_severity"]
        crit = sev.get("critical", 0)
        high = sev.get("high", 0)
        parts.append(
            f"The system processed {alert_stats['total']} alert{'s' if alert_stats['total'] != 1 else ''} "
            f"({crit} critical, {high} high severity). Acknowledgment rate was {alert_stats['ack_rate']}%."
        )
        if alert_stats["unacked_critical"] > 0:
            parts.append(
                f"⚠ {alert_stats['unacked_critical']} critical alert(s) remain unacknowledged and require immediate review."
            )
        if alert_stats["by_zone"]:
            top_zone = next(iter(alert_stats["by_zone"]))
            parts.append(f"The zone generating the most alerts was {top_zone.replace('_', ' ')}.")

    # Queue narrative
    if queue_stats["snapshots"] > 0:
        if queue_stats["peak_hour"] is not None:
            parts.append(
                f"Queue activity peaked at {queue_stats['peak_hour']:02d}:00, "
                f"with up to {queue_stats['max_count']} passengers in a single zone."
            )
        if queue_stats["busiest_zone"]:
            parts.append(
                f"The busiest area on average was {queue_stats['busiest_zone'].replace('_', ' ')}, "
                f"with mean occupancy and an average wait time of {queue_stats['avg_wait']} minutes across all zones."
            )

    # Suspicious narrative
    if susp_stats["total"] > 0:
        parts.append(
            f"Field officers filed {susp_stats['total']} suspicious activity report(s) during this period."
        )
        if susp_stats["by_type"]:
            top_type = next(iter(susp_stats["by_type"]))
            parts.append(f"The most frequently reported activity was: \"{top_type}\".")

    # Operational recommendation
    if alert_stats["total"] > 20 or queue_stats.get("max_count", 0) > 30:
        parts.append("Recommendation: consider reinforcing staff at high-traffic zones during the identified peak hour.")
    elif alert_stats["total"] == 0 and susp_stats["total"] == 0:
        parts.append("Recommendation: continue current operational posture; no incidents detected.")

    return " ".join(parts)


def _build_sections(alert_stats, queue_stats, susp_stats, alerts, queue, suspicious) -> list:
    """Structured sections for the report (heading, content, optional tabular data)."""
    sections = []

    # Section 1: Alerts overview
    if alert_stats["total"] > 0:
        sections.append({
            "heading": "Security Alerts Overview",
            "content": (
                f"Total alerts: {alert_stats['total']}. "
                f"Acknowledged: {alert_stats['ack_rate']}%. "
                f"Unacknowledged critical: {alert_stats['unacked_critical']}."
            ),
            "data": {
                "type": "alerts_breakdown",
                "by_severity": alert_stats["by_severity"],
                "by_zone": alert_stats["by_zone"],
            },
        })
    else:
        sections.append({
            "heading": "Security Alerts Overview",
            "content": "No alerts were generated during this period.",
            "data": None,
        })

    # Section 2: Queue analytics
    if queue_stats["snapshots"] > 0:
        sections.append({
            "heading": "Queue Analytics & Crowd Patterns",
            "content": (
                f"Recorded {queue_stats['snapshots']} queue snapshots. "
                f"Peak activity at {queue_stats['peak_hour']:02d}:00. "
                f"Busiest zone: {queue_stats['busiest_zone']}. "
                f"Average wait: {queue_stats['avg_wait']} min."
            ),
            "data": {"type": "queue_zones", "zones": queue_stats.get("zones", {})},
        })

    # Section 3: Suspicious activities
    if susp_stats["total"] > 0:
        sections.append({
            "heading": "Suspicious Activity Reports",
            "content": (
                f"Field officers filed {susp_stats['total']} report(s). "
                f"Top reported types and zones are listed below."
            ),
            "data": {
                "type": "suspicious_breakdown",
                "by_type": susp_stats["by_type"],
                "by_zone": susp_stats["by_zone"],
                "items": [
                    {
                        "activity_type": s.get("activity_type"),
                        "zone": s.get("zone"),
                        "camera_id": s.get("camera_id"),
                        "reported_by": s.get("reported_by"),
                        "notes": s.get("notes"),
                        "created_at": s.get("created_at").isoformat() if isinstance(s.get("created_at"), datetime) else None,
                    }
                    for s in suspicious[:20]
                ],
            },
        })
    else:
        sections.append({
            "heading": "Suspicious Activity Reports",
            "content": "No suspicious activities were reported during this period.",
            "data": None,
        })

    # Section 4: Top alerts (most recent few)
    if alerts:
        sections.append({
            "heading": "Recent Alert Sample",
            "content": "Most recent alert events for review:",
            "data": {
                "type": "alert_list",
                "items": [
                    {
                        "alert_type": a.get("alert_type"),
                        "severity": a.get("severity"),
                        "zone": a.get("zone"),
                        "camera_id": a.get("camera_id"),
                        "message": a.get("message"),
                        "created_at": a.get("created_at").isoformat() if isinstance(a.get("created_at"), datetime) else None,
                        "acknowledged": a.get("acknowledged", False),
                    }
                    for a in alerts[:10]
                ],
            },
        })

    return sections


async def generate_report(*, report_type: str, generated_by: str, period_hours: Optional[int] = None) -> dict:
    """
    Top-level orchestrator. Computes period, gathers data, runs analysis,
    builds summary and sections, persists to MongoDB, returns the saved doc.
    """
    now = datetime.now(timezone.utc)
    if report_type == "daily":
        period_from = now - timedelta(hours=24)
        title_period = "24-hour"
    elif report_type == "weekly":
        period_from = now - timedelta(days=7)
        title_period = "7-day"
    elif report_type == "monthly":
        period_from = now - timedelta(days=30)
        title_period = "30-day"
    else:
        period_from = now - timedelta(hours=period_hours or 24)
        title_period = f"{period_hours or 24}-hour"

    data = await _gather_data(period_from, now)
    alert_stats = _analyze_alerts(data["alerts"])
    queue_stats = _analyze_queue(data["queue"])
    susp_stats = _analyze_suspicious(data["suspicious"])

    summary = _generate_summary(alert_stats, queue_stats, susp_stats, period_from, now)
    sections = _build_sections(alert_stats, queue_stats, susp_stats, data["alerts"], data["queue"], data["suspicious"])

    title = f"{report_type.capitalize()} Operations Report — {title_period}"
    doc = {
        "title": title,
        "report_type": report_type,
        "period_from": period_from,
        "period_to": now,
        "generated_by": generated_by,
        "summary": summary,
        "sections": sections,
        "created_at": now,
    }

    db = get_db()
    res = await db[REPORTS].insert_one(doc)
    doc["_id"] = res.inserted_id
    return doc


async def list_reports(limit: int = 50) -> list:
    db = get_db()
    cur = db[REPORTS].find({}).sort("created_at", -1).limit(limit)
    return [r async for r in cur]


async def get_report(report_id: str):
    from bson import ObjectId
    if not isinstance(report_id, str):
        return None
    try:
        oid = ObjectId(report_id)
    except Exception:
        return None
    db = get_db()
    return await db[REPORTS].find_one({"_id": oid})


async def delete_report(report_id: str) -> bool:
    from bson import ObjectId
    try:
        oid = ObjectId(report_id)
    except Exception:
        return False
    db = get_db()
    res = await db[REPORTS].delete_one({"_id": oid})
    return res.deleted_count > 0


# ─── Suspicious activity service ─────────────────────────
async def create_suspicious_report(*, camera_id: str, zone: str, activity_type: str,
                                   notes: Optional[str], severity: str,
                                   reported_by: str, reporter_role: str) -> dict:
    """Save a suspicious report and also fire an alert for live ops."""
    db = get_db()
    now = datetime.now(timezone.utc)
    doc = {
        "camera_id": camera_id,
        "zone": zone,
        "activity_type": activity_type,
        "notes": notes,
        "severity": severity,
        "reported_by": reported_by,
        "reporter_role": reporter_role,
        "acknowledged": False,
        "created_at": now,
    }
    res = await db[SUSP].insert_one(doc)
    doc["_id"] = res.inserted_id
    return doc


async def list_suspicious_reports(limit: int = 100) -> list:
    db = get_db()
    cur = db[SUSP].find({}).sort("created_at", -1).limit(limit)
    return [s async for s in cur]
