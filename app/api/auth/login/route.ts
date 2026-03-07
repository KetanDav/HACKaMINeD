import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email, password } = (await request.json()) as {
    email: string;
    password: string;
  };

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const hardcodedDoctorEmail = process.env.CALLIFY_DOCTOR_EMAIL || "doctor@callify.app";
  const hardcodedDoctorPassword = process.env.CALLIFY_DOCTOR_PASSWORD || "Doctor@123";

  let { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (
    error &&
    email.toLowerCase() === hardcodedDoctorEmail.toLowerCase() &&
    password === hardcodedDoctorPassword
  ) {
    const admin = getSupabaseAdmin();
    await admin.auth.admin.createUser({
      email: hardcodedDoctorEmail,
      password: hardcodedDoctorPassword,
      email_confirm: true,
    });

    const retry = await supabase.auth.signInWithPassword({
      email: hardcodedDoctorEmail,
      password: hardcodedDoctorPassword,
    });

    data = retry.data;
    error = retry.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data.user) {
    return NextResponse.json({ error: "Login failed." }, { status: 400 });
  }

  return NextResponse.json({
    user: { id: data.user.id, email: data.user.email },
  });
}
