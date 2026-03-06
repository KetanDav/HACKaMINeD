from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum

class PlanType(str, Enum):
    free = "free"
    starter = "starter"
    pro = "pro"

class Severity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

# Auth
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    session_token: Optional[str] = None  # for merging anonymous scans

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

# Scan / Fraud
class FraudFlag(BaseModel):
    type: str
    detail: str
    severity: Severity
    confidence: int  # 0-100

class FraudReport(BaseModel):
    document_type: str
    trust_score: int  # 0-100
    severity: Severity
    flags: List[FraudFlag]
    recommendation: str
    summary: str

class ScanResponse(BaseModel):
    scan_id: str
    status: str
    report: Optional[FraudReport] = None
    created_at: datetime
    is_preview: bool = False  # True if user hit limit — shows partial result

# Payment
class CreateOrderRequest(BaseModel):
    plan: str  # "starter" or "pro"

class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str
    plan: str

# Session merge
class SessionMergeRequest(BaseModel):
    session_token: str
