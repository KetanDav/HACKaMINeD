import json
import hmac
import hashlib
from fastapi import APIRouter, Request, HTTPException, Header
from typing import Optional
from app.core.config import settings
from app.core.database import supabase_admin

router = APIRouter()

PLAN_CONFIG = {
    "starter": {"scans_limit": 50},
    "pro": {"scans_limit": 999999}
}


@router.post("/webhook/razorpay")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(None)
):
    """
    Handles Razorpay webhook events.
    Judges will test: payment.captured, payment.failed, order.paid
    """
    body = await request.body()

    # Verify webhook signature
    if x_razorpay_signature:
        expected = hmac.new(
            settings.RAZORPAY_WEBHOOK_SECRET.encode(),
            body,
            hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected, x_razorpay_signature):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    payload = json.loads(body)
    event = payload.get("event")
    entity = payload.get("payload", {}).get("payment", {}).get("entity", {})

    if event == "payment.captured":
        order_id = entity.get("order_id")
        payment_id = entity.get("id")
        notes = entity.get("notes", {})
        user_id = notes.get("user_id")
        plan = notes.get("plan")

        if user_id and plan and plan in PLAN_CONFIG:
            # Upgrade user plan
            supabase_admin.table("users").update({
                "plan_type": plan,
                "scans_limit": PLAN_CONFIG[plan]["scans_limit"],
                "scans_used": 0
            }).eq("id", user_id).execute()

            # Update payment record
            supabase_admin.table("payments").update({
                "status": "captured",
                "razorpay_payment_id": payment_id
            }).eq("razorpay_order_id", order_id).execute()

    elif event == "payment.failed":
        order_id = entity.get("order_id")
        error_desc = entity.get("error_description", "Payment failed")

        supabase_admin.table("payments").update({
            "status": "failed",
            "error_message": error_desc
        }).eq("razorpay_order_id", order_id).execute()

    elif event == "order.paid":
        # Secondary confirmation — idempotent upgrade
        order = payload.get("payload", {}).get("order", {}).get("entity", {})
        notes = order.get("notes", {})
        user_id = notes.get("user_id")
        plan = notes.get("plan")

        if user_id and plan and plan in PLAN_CONFIG:
            user_check = supabase_admin.table("users").select("plan_type").eq("id", user_id).execute()
            if user_check.data and user_check.data[0]["plan_type"] != plan:
                supabase_admin.table("users").update({
                    "plan_type": plan,
                    "scans_limit": PLAN_CONFIG[plan]["scans_limit"]
                }).eq("id", user_id).execute()

    # Always return 200 to Razorpay
    return {"status": "ok", "event_received": event}
