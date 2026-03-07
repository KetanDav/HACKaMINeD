import { gatherSpeechTwiml, twimlResponse } from "@/lib/telephony/twiml";
import {
  isAllowedDemoTwilioSource,
  isDemoTwilioSignatureValid,
} from "@/lib/telephony/twilioDemoValidation";

export const runtime = "nodejs";

function getBaseUrl() {
  return process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function buildVoiceResponse() {
  const baseUrl = getBaseUrl();
  const actionUrl = `${baseUrl}/api/telephony/twilio/demo/gather`;
  const languageCode =
    process.env.TELEPHONY_DEMO_LANGUAGE_CODE || process.env.TELEPHONY_LANGUAGE_CODE || "en-IN";
  const welcomePrompt =
    process.env.TELEPHONY_DEMO_WELCOME_PROMPT ||
    "Welcome to the demo line. Please ask your question.";

  return twimlResponse(
    gatherSpeechTwiml({
      actionUrl,
      prompt: welcomePrompt,
      languageCode,
    }),
  );
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();

    if (!isAllowedDemoTwilioSource(form)) {
      return twimlResponse(
        '<Say voice="alice">This call is not coming from the configured demo Twilio number.</Say>',
      );
    }

    if (!isDemoTwilioSignatureValid(request, form)) {
      return new Response("Invalid Twilio signature", { status: 403 });
    }

    console.log(
      JSON.stringify({
        event: "twilio.demo.voice.request",
        path: "/api/telephony/twilio/demo/voice",
        payload: Object.fromEntries(form.entries()),
      }),
    );
  } catch (error) {
    console.error("twilio demo voice failed", error);
  }

  return buildVoiceResponse();
}

export async function GET() {
  return buildVoiceResponse();
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
