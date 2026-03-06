import razorpay
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from app.core.config import settings
from app.core.database import supabase_admin
from app.core.security import get_current_user_required
from app.models.schemas import CreateOrderRequest, CreateOrderResponse

router = APIRouter()

razorpay_client = razorpay.Client(
    auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
)

PLAN_CONFIG = {
    "starter": {
        "amount": 49900,       # ₹499 in paise
        "scans_limit": 50,
        "name": "FraudScan Starter"
    },
    "pro": {
        "amount": 149900,      # ₹1499 in paise
        "scans_limit": 999999,
        "name": "FraudScan Pro"
    }
}


@router.post("/payments/create-order", response_model=CreateOrderResponse)
async def create_order(
    data: CreateOrderRequest,
    authorization: Optional[str] = Header(None)
):
    """Creates a Razorpay order for plan upgrade. Requires authentication."""
    user = get_current_user_required(authorization)

    if data.plan not in PLAN_CONFIG:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {data.plan}. Choose 'starter' or 'pro'")

    plan = PLAN_CONFIG[data.plan]

    # Create Razorpay order (test mode)
    order = razorpay_client.order.create({
        "amount": plan["amount"],
        "currency": "INR",
        "receipt": f"fraudscan_{user['sub'][:8]}_{data.plan}",
        "notes": {
            "user_id": user["sub"],
            "plan": data.plan,
            "product": "FraudScan"
        }
    })

    # Store pending payment
    supabase_admin.table("payments").insert({
        "user_id": user["sub"],
        "razorpay_order_id": order["id"],
        "plan": data.plan,
        "amount": plan["amount"],
        "status": "pending"
    }).execute()

    return CreateOrderResponse(
        order_id=order["id"],
        amount=plan["amount"],
        currency="INR",
        key_id=settings.RAZORPAY_KEY_ID,
        plan=data.plan
    )


@router.post("/payments/verify")
async def verify_payment(
    payload: dict,
    authorization: Optional[str] = Header(None)
):
    """Verifies Razorpay payment signature and upgrades user plan."""
    user = get_current_user_required(authorization)

    try:
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": payload["razorpay_order_id"],
            "razorpay_payment_id": payload["razorpay_payment_id"],
            "razorpay_signature": payload["razorpay_signature"]
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Payment signature verification failed")

    # Fetch pending payment
    payment = supabase_admin.table("payments").select("*").eq(
        "razorpay_order_id", payload["razorpay_order_id"]
    ).execute()

    if not payment.data:
        raise HTTPException(status_code=404, detail="Payment record not found")

    plan_name = payment.data[0]["plan"]
    plan_config = PLAN_CONFIG[plan_name]

    # Upgrade user
    supabase_admin.table("users").update({
        "plan_type": plan_name,
        "scans_limit": plan_config["scans_limit"],
        "scans_used": 0,  # reset on upgrade
        "razorpay_customer_id": payload["razorpay_payment_id"]
    }).eq("id", user["sub"]).execute()

    # Mark payment complete
    supabase_admin.table("payments").update({
        "status": "captured",
        "razorpay_payment_id": payload["razorpay_payment_id"]
    }).eq("razorpay_order_id", payload["razorpay_order_id"]).execute()

    return {
        "success": True,
        "plan": plan_name,
        "scans_limit": plan_config["scans_limit"],
        "message": f"Successfully upgraded to {plan_name.title()} plan!"
    }
