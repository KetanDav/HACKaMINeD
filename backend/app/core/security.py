import secrets
import hashlib
import hmac
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import HTTPException, Security, Header
from app.core.config import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days

def generate_session_token() -> str:
    return secrets.token_urlsafe(32)

def create_access_token(user_id: str, email: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expire,
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """Returns user if authenticated, None if anonymous"""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    try:
        return decode_access_token(token)
    except:
        return None

def get_current_user_required(authorization: Optional[str] = Header(None)) -> dict:
    user = get_current_user_optional(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user

def verify_razorpay_webhook(body: bytes, signature: str) -> bool:
    expected = hmac.new(
        settings.RAZORPAY_WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
