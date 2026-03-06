import uuid
import bcrypt
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from app.core.database import supabase_admin
from app.core.security import create_access_token, decode_access_token
from app.models.schemas import UserRegister, UserLogin, TokenResponse
from app.core.config import settings

router = APIRouter()

@router.post("/register", response_model=TokenResponse)
async def register(data: UserRegister):
    # Check if email exists
    existing = supabase_admin.table("users").select("id").eq("email", data.email).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="Email already registered")

    # Hash password
    hashed = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    user_id = str(uuid.uuid4())

    # Create user
    user_record = {
        "id": user_id,
        "email": data.email,
        "password_hash": hashed,
        "plan_type": "free",
        "scans_used": 0,
        "scans_limit": settings.PLAN_FREE_LIMIT
    }
    supabase_admin.table("users").insert(user_record).execute()

    # ── SESSION MERGE: Transfer anonymous scans to new account ──────────
    if data.session_token:
        supabase_admin.table("scans").update({
            "user_id": user_id
        }).eq("session_token", data.session_token).is_("user_id", "null").execute()

        # Mark session as converted
        supabase_admin.table("sessions").update({
            "converted_to_user": user_id
        }).eq("session_token", data.session_token).execute()

    token = create_access_token(user_id, data.email)
    return TokenResponse(
        access_token=token,
        user={"id": user_id, "email": data.email, "plan_type": "free", "scans_limit": settings.PLAN_FREE_LIMIT, "scans_used": 0}
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin):
    result = supabase_admin.table("users").select("*").eq("email", data.email).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = result.data[0]
    if not bcrypt.checkpw(data.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user["id"], user["email"])
    return TokenResponse(
        access_token=token,
        user={
            "id": user["id"],
            "email": user["email"],
            "plan_type": user["plan_type"],
            "scans_limit": user["scans_limit"],
            "scans_used": user["scans_used"]
        }
    )


@router.get("/me")
async def get_me(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_access_token(authorization.split(" ")[1])
    result = supabase_admin.table("users").select(
        "id, email, plan_type, scans_used, scans_limit, created_at"
    ).eq("id", payload["sub"]).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")

    return result.data[0]
