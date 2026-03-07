import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      name?: string;
      date?: string;
      time?: string;
    };

    const customerName = String(body.name || "").trim();
    const slotDate = String(body.date || "").trim();
    const rawTime = String(body.time || "").trim();

    if (!customerName || !slotDate || !rawTime) {
      return NextResponse.json({ error: "Name, date and time are required." }, { status: 400 });
    }

    const dateMatch = slotDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) {
      return NextResponse.json({ error: "Invalid date format." }, { status: 400 });
    }

    const timeMatch = rawTime.match(/^(\d{2}):(\d{2})$/);
    if (!timeMatch) {
      return NextResponse.json({ error: "Invalid time format." }, { status: 400 });
    }
    const slotTime = `${timeMatch[1]}:${timeMatch[2]}:00`;

    const admin = getSupabaseAdmin();

    const doctorEmail = (process.env.CALLIFY_DOCTOR_EMAIL || "doctor@callify.app").toLowerCase();
    let businessProfileId = process.env.CALLIFY_DOCTOR_BUSINESS_PROFILE_ID || "";

    if (!businessProfileId) {
      const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 100 });
      const doctorUser = authUsers?.users?.find(
        (u) => (u.email || "").toLowerCase() === doctorEmail,
      );

      if (doctorUser) {
        const { data: profile } = await admin
          .from("business_profiles")
          .select("id")
          .eq("user_id", doctorUser.id)
          .maybeSingle<{ id: string }>();
        businessProfileId = profile?.id || "";
      }
    }

    if (!businessProfileId) {
      return NextResponse.json({ error: "Doctor profile not found." }, { status: 404 });
    }

    const { error } = await admin.from("appointment_slots").upsert(
      {
        business_profile_id: businessProfileId,
        slot_date: slotDate,
        slot_time: slotTime,
        status: "booked",
        customer_name: customerName,
      },
      { onConflict: "business_profile_id,slot_date,slot_time" },
    );

    if (error) {
      console.error("ketan book error", error);
      return NextResponse.json({ error: "Failed to book appointment." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("ketan book failed", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
