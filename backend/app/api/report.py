import json
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from app.core.database import supabase_admin
from app.core.security import get_current_user_optional

router = APIRouter()

@router.get("/report/{scan_id}")
async def get_report(
    scan_id: str,
    x_session_token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """
    Returns full fraud analysis report for a completed scan.
    Accessible by owner (user or session).
    """
    result = supabase_admin.table("scans").select("*").eq("id", scan_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Report not found")

    scan = result.data[0]

    # Verify ownership
    user = get_current_user_optional(authorization)
    user_id = user["sub"] if user else None

    if scan["user_id"] and scan["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if not scan["user_id"] and scan.get("session_token") != x_session_token:
        raise HTTPException(status_code=403, detail="Invalid session token")

    if scan["status"] == "processing":
        return {"scan_id": scan_id, "status": "processing", "message": "Analysis in progress..."}

    if scan["status"] == "failed":
        return {"scan_id": scan_id, "status": "failed", "message": scan.get("error_message", "Unknown error")}

    flags = json.loads(scan.get("flags_json") or "[]")

    return {
        "scan_id": scan_id,
        "status": "complete",
        "report": {
            "document_type": scan["document_type"],
            "trust_score": scan["trust_score"],
            "severity": scan["severity"],
            "flags": flags,
            "recommendation": scan["recommendation"],
            "summary": scan.get("summary", "")
        },
        "original_filename": scan.get("original_filename"),
        "created_at": scan["created_at"],
        "completed_at": scan.get("completed_at")
    }


@router.get("/scans/history")
async def get_scan_history(
    authorization: Optional[str] = Header(None),
    x_session_token: Optional[str] = Header(None)
):
    """Returns scan history for authenticated user or anonymous session."""
    user = get_current_user_optional(authorization)

    if user:
        result = supabase_admin.table("scans").select(
            "id, document_type, trust_score, severity, recommendation, created_at, original_filename, status"
        ).eq("user_id", user["sub"]).order("created_at", desc=True).limit(50).execute()
    elif x_session_token:
        result = supabase_admin.table("scans").select(
            "id, document_type, trust_score, severity, recommendation, created_at, original_filename, status"
        ).eq("session_token", x_session_token).is_("user_id", "null").order("created_at", desc=True).execute()
    else:
        return {"scans": []}

    return {"scans": result.data or []}
