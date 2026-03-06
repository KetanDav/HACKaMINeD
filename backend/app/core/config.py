from pydantic_settings import BaseSettings
from typing import List, ClassVar, Dict

class Settings(BaseSettings):
    # App
    APP_NAME: str = "FraudScan"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production-use-256-bit-key"

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # Anthropic Claude
    ANTHROPIC_API_KEY: str = ""

    # Razorpay
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Plans
    PLAN_FREE_LIMIT: int = 3
    PLAN_STARTER_LIMIT: int = 50
    PLAN_PRO_LIMIT: int = 999999

    # ClassVar — not a pydantic field, just a constant
    PLAN_PRICES: ClassVar[Dict[str, int]] = {
        "starter": 49900,
        "pro": 149900
    }

    class Config:
        env_file = ".env"

settings = Settings()
