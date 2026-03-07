import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function normalizeDate(value: string) {
  const trimmed = String(value || "").trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function normalizeTime(value: string) {
  const trimmed = String(value || "").trim();
  const match = trimmed.match(/^(\d{2}):(\d{2})$/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";
  return `${match[1]}:${match[2]}:00`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      slotDate?: string;
      slotTime?: string;
      status?: "free" | "booked";
      customerName?: string;
      customerPhone?: string;
      notes?: string;
    };

    const slotDate = normalizeDate(body.slotDate || "");
    const slotTime = normalizeTime(body.slotTime || "");
    const status = body.status === "booked" ? "booked" : "free";

    if (!slotDate || !slotTime) {
      return NextResponse.json({ error: "Invalid date or time format." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from("business_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle<{ id: string }>();

    if (!profile?.id) {
      return NextResponse.json({ error: "Business profile not found." }, { status: 404 });
    }

    const payload = {
      business_profile_id: profile.id,
      slot_date: slotDate,
      slot_time: slotTime,
      status,
      customer_name: status === "booked" ? String(body.customerName || "").trim() || null : null,
      customer_phone: status === "booked" ? String(body.customerPhone || "").trim() || null : null,
      notes: String(body.notes || "").trim() || null,
    };

    const { error } = await admin.from("appointment_slots").upsert(payload, {
      onConflict: "business_profile_id,slot_date,slot_time",
    });

    if (error) {
      return NextResponse.json({ error: "Failed to save appointment slot." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("dashboard appointments save failed", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
