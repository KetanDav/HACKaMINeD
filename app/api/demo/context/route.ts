import { NextResponse } from "next/server";
import {
  getDefaultDemoContextText,
  getDemoContextText,
  setDemoContextText,
} from "@/lib/demoContextStore";

export async function GET() {
  const baseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const demoPhoneNumber = process.env.TWILIO_DEMO_PHONE_NUMBER || "";
  const demoWebhookUrl = `${baseUrl}/api/telephony/twilio/demo/voice`;

  return NextResponse.json({
    text: getDemoContextText(),
    defaultText: getDefaultDemoContextText(),
    demoPhoneNumber,
    demoWebhookUrl,
  });
}

export async function POST(request: Request) {
  const baseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const demoPhoneNumber = process.env.TWILIO_DEMO_PHONE_NUMBER || "";
  const demoWebhookUrl = `${baseUrl}/api/telephony/twilio/demo/voice`;
  const payload = (await request.json().catch(() => ({}))) as { text?: string };
  const text = setDemoContextText(String(payload.text || ""));
  return NextResponse.json({ ok: true, text, demoPhoneNumber, demoWebhookUrl });
}
