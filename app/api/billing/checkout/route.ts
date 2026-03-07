import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCashfree, getTierAmount } from "@/lib/cashfree/client";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {
    const maybe = error as {
      message?: string;
      response?: { data?: { message?: string; error?: string } };
      details?: string;
    };

    return (
      maybe.response?.data?.message ||
      maybe.response?.data?.error ||
      maybe.message ||
      maybe.details ||
      "Payment initiation failed."
    );
  }

  return "Payment initiation failed.";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please login again." },
        { status: 401 },
      );
    }

    const { businessId, tier } = (await request.json()) as {
      businessId: string;
      tier: number;
    };

    if (!businessId || !tier || tier < 1 || tier > 4) {
      return NextResponse.json(
        { error: "Valid businessId and tier (1-4) are required." },
        { status: 400 },
      );
    }

    const amount = getTierAmount(tier);
    if (!amount) {
      return NextResponse.json({ error: "Invalid tier." }, { status: 400 });
    }

    // Verify the business belongs to this user.
    const admin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await admin
      .from("business_profiles")
      .select("id, business_name, plan_status")
      .eq("id", businessId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: `Failed to load business: ${profileError.message}` },
        { status: 500 },
      );
    }

    if (!profile) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    const orderId = `CF_${businessId.slice(0, 8)}_${Date.now()}`;

    const cashfree = getCashfree();

    const orderRequest = {
      order_amount: amount,
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: user.id.replace(/-/g, "").slice(0, 20),
        customer_email: user.email!,
        customer_phone: "9999999999", // placeholder - will be updated from profile
      },
      order_meta: {
        return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard?payment_status=success&order_id=${orderId}`,
      },
      order_note: `Callify Tier ${tier} - ${profile.business_name}`,
    };

    const response = await cashfree.PGCreateOrder(orderRequest);
    const orderData = response.data;

    // Save payment record
    const { error: insertPaymentError } = await admin.from("payments").insert({
      business_profile_id: businessId,
      user_id: user.id,
      order_id: orderId,
      provider: "cashfree",
      amount,
      currency: "INR",
      raw_payload: {
        payment_session_id: orderData.payment_session_id,
      },
      status: "PENDING",
      tier,
    });

    if (insertPaymentError) {
      return NextResponse.json(
        { error: `Failed to save payment record: ${insertPaymentError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      orderId,
      paymentSessionId: orderData.payment_session_id,
      amount,
      tier,
    });
  } catch (error: unknown) {
    console.error("Cashfree create order failed:", error);
    const message = getErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
