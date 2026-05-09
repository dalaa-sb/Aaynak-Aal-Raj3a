"""
Reports API.
- POST /api/reports/generate    — admin: trigger AI assistant to build a new report
- GET  /api/reports/            — list all reports
- GET  /api/reports/{id}        — get single report (JSON)
- GET  /api/reports/{id}/pdf    — download as PDF
- DELETE /api/reports/{id}      — admin only

- POST /api/reports/suspicious  — any authenticated user files a suspicious activity report
- GET  /api/reports/suspicious  — list suspicious activity reports
- GET  /api/reports/activity-types — predefined Arabic activity types
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from io import BytesIO

from backend.models.schemas import (
    ReportGenerateRequest, SuspiciousReportCreate, SUSPICIOUS_ACTIVITY_TYPES,
)
from backend.security.deps import get_current_session, require_admin
from backend.security.rate_limit import limiter
from backend.services import report_service
from backend.services import audit_service
from backend.services.pdf_generator import render_report_pdf

router = APIRouter(prefix="/api/reports", tags=["reports"])


# ─── Predefined Arabic activity types (public for authenticated users) ─
@router.get("/activity-types")
async def list_activity_types(session: dict = Depends(get_current_session)):
    return {"types": SUSPICIOUS_ACTIVITY_TYPES}


# ─── Suspicious activity submission (security + admin) ────
@router.post("/suspicious")
@limiter.limit("20/minute")
async def submit_suspicious_report(
    request: Request,
    req: SuspiciousReportCreate,
    session: dict = Depends(get_current_session),
):
    """
    File a suspicious activity report. Saved to suspicious_reports collection
    and also fired as a live alert for ops staff.
    """
    doc = await report_service.create_suspicious_report(
        camera_id=req.camera_id,
        zone=req.zone,
        activity_type=req.activity_type,
        notes=req.notes,
        severity=req.severity,
        reported_by=session["username"],
        reporter_role=session["role"],
    )

    # Also fire as a live alert (best effort)
    try:
        from backend.services import alert_service
        from backend.models.schemas import AlertCreate
        alert_msg = f"تقرير ميداني: {req.activity_type}"
        if req.notes:
            alert_msg += f" — {req.notes[:120]}"
        await alert_service.create_alert(AlertCreate(
            camera_id=req.camera_id,
            zone=req.zone,
            alert_type="suspicious_activity",
            severity=req.severity,
            message=alert_msg,
            value=None,
        ))
    except Exception:
        pass  # Suspicious report is saved either way

    await audit_service.log_action(
        action="suspicious_report.filed",
        actor_username=session["username"], actor_role=session["role"],
        target_type="suspicious_report", target_id=str(doc.get("_id")),
        metadata={"zone": req.zone, "camera_id": req.camera_id,
                  "activity_type": req.activity_type, "severity": req.severity},
        request=request,
    )

    return {
        "success": True,
        "id": str(doc.get("_id")),
        "message": "Suspicious activity report filed and added to the reports archive.",
    }


@router.get("/suspicious")
async def list_suspicious(session: dict = Depends(get_current_session), limit: int = 100):
    """List recent suspicious reports — visible to admin and security."""
    docs = await report_service.list_suspicious_reports(limit=limit)
    out = []
    for d in docs:
        out.append({
            "id": str(d.get("_id")),
            "camera_id": d.get("camera_id"),
            "zone": d.get("zone"),
            "activity_type": d.get("activity_type"),
            "notes": d.get("notes"),
            "severity": d.get("severity"),
            "reported_by": d.get("reported_by"),
            "reporter_role": d.get("reporter_role"),
            "acknowledged": d.get("acknowledged", False),
            "created_at": d.get("created_at").isoformat() if d.get("created_at") else None,
        })
    return out


# ─── AI-generated reports (admin) ────────────────────────
@router.post("/generate")
@limiter.limit("10/minute")
async def generate_report_endpoint(
    request: Request,
    req: ReportGenerateRequest,
    session: dict = Depends(require_admin),
):
    """Trigger the AI assistant to aggregate data and produce a new report."""
    doc = await report_service.generate_report(
        report_type=req.report_type,
        generated_by=session["username"],
        period_hours=req.period_hours,
    )
    await audit_service.log_action(
        action="report.generated",
        actor_username=session["username"], actor_role=session["role"],
        target_type="report", target_id=str(doc.get("_id", "")),
        metadata={"report_type": req.report_type, "period_hours": req.period_hours},
        request=request,
    )
    return _serialize(doc)


@router.get("/")
async def list_reports_endpoint(session: dict = Depends(get_current_session)):
    """List all generated reports — both admin and security can view."""
    docs = await report_service.list_reports()
    return [_serialize(d) for d in docs]


@router.get("/{report_id}")
async def get_report_endpoint(report_id: str, session: dict = Depends(get_current_session)):
    doc = await report_service.get_report(report_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    return _serialize(doc)


@router.get("/{report_id}/pdf")
async def download_report_pdf(
    report_id: str, request: Request,
    session: dict = Depends(get_current_session),
):
    """Stream the report as a PDF download."""
    doc = await report_service.get_report(report_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")

    pdf_bytes = render_report_pdf(doc)
    safe_title = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in doc.get("title", "report"))[:60]
    filename = f"{safe_title}.pdf"

    await audit_service.log_action(
        action="report.downloaded",
        actor_username=session["username"], actor_role=session["role"],
        target_type="report", target_id=report_id,
        metadata={"size_bytes": len(pdf_bytes)},
        request=request,
    )

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{report_id}")
async def delete_report_endpoint(
    report_id: str, request: Request,
    session: dict = Depends(require_admin),
):
    ok = await report_service.delete_report(report_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Report not found")
    await audit_service.log_action(
        action="report.deleted",
        actor_username=session["username"], actor_role=session["role"],
        target_type="report", target_id=report_id,
        request=request,
    )
    return {"success": True}


# ─── Serialization helper ────────────────────────────────
def _serialize(doc: dict) -> dict:
    if not doc:
        return {}
    out = dict(doc)
    out["id"] = str(out.pop("_id", ""))
    for k in ("period_from", "period_to", "created_at"):
        v = out.get(k)
        if hasattr(v, "isoformat"):
            out[k] = v.isoformat()
    return out
