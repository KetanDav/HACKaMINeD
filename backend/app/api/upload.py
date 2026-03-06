import uuid
from fastapi import APIRouter, UploadFile, File, Header, HTTPException
from typing import Optional
from app.core.database import supabase_admin
from app.core.security import get_current_user_optional

router = APIRouter()

ALLOWED_TYPES = [
    "application/pdf",
    "image/jpeg", "image/jpg", "image/png", "image/webp"
]
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    x_session_token: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """
    Upload a document for fraud analysis.
    Supports anonymous sessions (x-session-token header) and authenticated users.
    Returns upload_id to be used in /scan endpoint.
    """
    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Allowed: PDF, JPEG, PNG, WEBP"
        )

    # Read and validate size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")

    if len(content) < 100:
        raise HTTPException(status_code=400, detail="File appears to be empty or corrupted.")

    # Get user context
    user = get_current_user_optional(authorization)
    user_id = user["sub"] if user else None

    # Ensure session token exists
    if not x_session_token and not user_id:
        x_session_token = str(uuid.uuid4())

    # Check scan limits
    if user_id:
        user_record = supabase_admin.table("users").select("scans_used, scans_limit, plan_type").eq("id", user_id).single().execute()
        if user_record.data:
            u = user_record.data
            if u["scans_used"] >= u["scans_limit"]:
                raise HTTPException(
                    status_code=402,
                    detail={
                        "error": "SCAN_LIMIT_REACHED",
                        "message": f"You've used all {u['scans_limit']} scans on your {u['plan_type']} plan.",
                        "upgrade_required": True
                    }
                )
    elif x_session_token:
        # Check anonymous scan count (max 1 free scan for anonymous)
        anon_scans = supabase_admin.table("scans").select("id").eq("session_token", x_session_token).is_("user_id", "null").execute()
        if len(anon_scans.data or []) >= 1:
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "ANONYMOUS_LIMIT_REACHED",
                    "message": "Create a free account to get 3 scans per month.",
                    "signup_required": True
                }
            )

    # Upload to Supabase Storage
    upload_id = str(uuid.uuid4())
    file_path = f"documents/{upload_id}/{file.filename}"

    supabase_admin.storage.from_("documents").upload(
        file_path,
        content,
        {"content-type": file.content_type}
    )

    # Create pending scan record
    scan_record = {
        "id": upload_id,
        "user_id": user_id,
        "session_token": x_session_token,
        "status": "pending",
        "file_path": file_path,
        "file_type": file.content_type,
        "original_filename": file.filename
    }
    supabase_admin.table("scans").insert(scan_record).execute()

    return {
        "upload_id": upload_id,
        "status": "uploaded",
        "message": "Document uploaded. Call POST /scan to analyze.",
        "session_token": x_session_token
    }
