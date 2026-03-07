import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // Also fetch the business profile if it exists
  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("business_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    profile,
  });
}
