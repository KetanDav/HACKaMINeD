from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import upload, scan, report, webhook, auth, payments
from app.core.config import settings

app = FastAPI(
    title="FraudScan API",
    description="AI-powered document fraud detection for Indian SMBs",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(scan.router, prefix="/api", tags=["scan"])
app.include_router(report.router, prefix="/api", tags=["report"])
app.include_router(payments.router, prefix="/api", tags=["payments"])
app.include_router(webhook.router, prefix="/api", tags=["webhook"])

@app.get("/health")
def health():
    return {"status": "ok", "service": "FraudScan API v1.0"}
