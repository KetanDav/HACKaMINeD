import json
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from datetime import datetime

from app.core.database import supabase_admin
from app.core.security import get_current_user_optional
from app.services.document_service import (
    analyze_pdf_metadata,
    extract_text_from_document,
    validate_indian_business_data
)
from app.services.claude_service import analyze_document_with_claude

router = APIRouter()


@router.post("/scan/{upload_id}")
async def run_fraud_scan(
    upload_id: str,
    x_session_token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """
    Runs the full 4-layer fraud detection pipeline on an uploaded document.
    
    Layer 1: PDF metadata forensics
    Layer 2: AI visual forensics (Claude Vision)
    Layer 3: Indian business data validation (GST, PAN, math)
    Layer 4: AI pattern intelligence (Claude text analysis)
    
    Returns deterministic JSON fraud report.
    """
    # Fetch scan record
    scan_result = supabase_admin.table("scans").select("*").eq("id", upload_id).execute()
    if not scan_result.data:
        raise HTTPException(status_code=404, detail="Upload not found")

    scan = scan_result.data[0]

    # Verify ownership
    user = get_current_user_optional(authorization)
    user_id = user["sub"] if user else None

    if scan["user_id"] and scan["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if not scan["user_id"] and scan["session_token"] != x_session_token:
        raise HTTPException(status_code=403, detail="Invalid session token")

    # Mark as processing
    supabase_admin.table("scans").update({"status": "processing"}).eq("id", upload_id).execute()

    try:
        # Download file from storage
        file_content = supabase_admin.storage.from_("documents").download(scan["file_path"])
        file_type = scan["file_type"]

        # ── LAYER 1: Metadata Analysis ──────────────────────────────────
        metadata_flags = []
        if file_type == "application/pdf":
            metadata_flags = analyze_pdf_metadata(file_content)

        # ── LAYER 3: Data Validation (run before AI for context) ─────────
        extracted_text = extract_text_from_document(file_content, file_type)
        validation_flags = validate_indian_business_data(extracted_text)

        # Merge pre-analysis flags to pass as context to Claude
        pre_analysis_flags = metadata_flags + validation_flags

        # ── LAYER 2 + 4: Claude AI Visual Forensics + Pattern Intelligence ──
        fraud_report = await analyze_document_with_claude(
            file_content=file_content,
            file_type=file_type,
            metadata_flags=pre_analysis_flags,
            extracted_text=extracted_text
        )

        # Merge any pre-analysis flags not already caught by Claude
        existing_flag_types = {f.type for f in fraud_report.flags}
        for flag in pre_analysis_flags:
            if flag["type"] not in existing_flag_types:
                from app.models.schemas import FraudFlag, Severity
                fraud_report.flags.append(FraudFlag(
                    type=flag["type"],
                    detail=flag["detail"],
                    severity=Severity(flag["severity"]),
                    confidence=flag["confidence"]
                ))

        # Save report to database
        report_data = fraud_report.model_dump()
        report_data["flags"] = [f.model_dump() for f in fraud_report.flags]

        supabase_admin.table("scans").update({
            "status": "complete",
            "document_type": fraud_report.document_type,
            "trust_score": fraud_report.trust_score,
            "severity": fraud_report.severity,
            "flags_json": json.dumps(report_data["flags"]),
            "recommendation": fraud_report.recommendation,
            "summary": fraud_report.summary,
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", upload_id).execute()

        # Increment scan count for authenticated users
        if user_id:
            supabase_admin.rpc("increment_scan_count", {"p_user_id": user_id}).execute()

        return {
            "scan_id": upload_id,
            "status": "complete",
            "report": report_data,
            "created_at": scan["created_at"]
        }

    except Exception as e:
        supabase_admin.table("scans").update({
            "status": "failed",
            "error_message": str(e)
        }).eq("id", upload_id).execute()
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")
