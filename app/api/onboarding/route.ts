import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type IncomingBusiness = {
  businessName: string;
  category: "doctor" | "hotel" | "salon" | "other";
  city: string;
  phone: string;
  timezone?: string;
  systemPrompt?: string;
};

type OnboardingRequest = {
  business: IncomingBusiness;
  tier: number;
};

function isValidTier(tier: number) {
  return Number.isInteger(tier) && tier >= 1 && tier <= 4;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    const body = (await request.json()) as OnboardingRequest;
    const business = body?.business;
    const tier = Number(body?.tier || 0);

    if (!business?.businessName?.trim()) {
      return NextResponse.json({ error: "Business name is required." }, { status: 400 });
    }
    if (!business?.category?.trim()) {
      return NextResponse.json({ error: "Category is required." }, { status: 400 });
    }
    if (!business?.city?.trim()) {
      return NextResponse.json({ error: "City is required." }, { status: 400 });
    }
    if (!business?.phone?.trim()) {
      return NextResponse.json({ error: "Phone is required." }, { status: 400 });
    }
    if (!isValidTier(tier)) {
      return NextResponse.json({ error: "Tier must be between 1 and 4." }, { status: 400 });
    }

    const payload = {
      user_id: user.id,
      business_name: business.businessName.trim(),
      category: business.category,
      city: business.city.trim(),
      phone: business.phone.trim(),
      timezone: business.timezone?.trim() || "Asia/Kolkata",
      system_prompt: business.systemPrompt?.trim() || null,
      plan_status: "pending_payment",
    };

    const { data: existingProfile } = await admin
      .from("business_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    let businessId = "";

    if (existingProfile?.id) {
      const { data: updated, error: updateError } = await admin
        .from("business_profiles")
        .update(payload)
        .eq("id", existingProfile.id)
        .select("id")
        .single();

      if (updateError) {
        throw updateError;
      }

      businessId = updated.id;
    } else {
      const { data: inserted, error: insertError } = await admin
        .from("business_profiles")
        .insert(payload)
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      businessId = inserted.id;
    }

    const { error: factError } = await admin.from("business_facts").upsert(
      {
        business_profile_id: businessId,
        fact_key: "selected_tier",
        fact_value: { tier },
      },
      { onConflict: "business_profile_id,fact_key" },
    );

    if (factError) {
      throw factError;
    }

    return NextResponse.json({
      ok: true,
      businessId,
      tier,
      planStatus: "pending_payment",
    });
  } catch (error: unknown) {
    console.error("onboarding create failed", error);
    const message = error instanceof Error ? error.message : "Failed to save onboarding details.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    const { data: profile, error: profileError } = await admin
      .from("business_profiles")
      .select("id, business_name, category, city, phone, timezone, system_prompt, plan_status, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    const { data: selectedTierFact } = await admin
      .from("business_facts")
      .select("fact_value")
      .eq("business_profile_id", profile?.id || "")
      .eq("fact_key", "selected_tier")
      .maybeSingle();

    const { data: payments } = await admin
      .from("payments")
      .select("id, order_id, amount, currency, tier, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      profile,
      selectedTier: selectedTierFact?.fact_value?.tier || null,
      payments: payments || [],
    });
  } catch (error) {
    console.error("onboarding fetch failed", error);
    return NextResponse.json({ error: "Failed to fetch onboarding data." }, { status: 500 });
  }
}
