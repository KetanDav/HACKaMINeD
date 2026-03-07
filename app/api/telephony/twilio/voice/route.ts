import { gatherSpeechTwiml, twimlResponse } from "@/lib/telephony/twiml";
import { isInboundToDemoNumber } from "@/lib/telephony/twilioDemoValidation";

export const runtime = "nodejs";

function buildVoiceResponse() {
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const actionUrl = `${baseUrl}/api/telephony/twilio/gather`;
  const languageCode = process.env.TELEPHONY_LANGUAGE_CODE || "en-IN";
  const welcomePrompt =
    process.env.TELEPHONY_WELCOME_PROMPT ||
    "Welcome to VoiceDesk AI support. Please tell me your question.";

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
    const isDemoInbound = isInboundToDemoNumber(form);

    const payloadEntries = Object.fromEntries(form.entries());
    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    const actionUrl = isDemoInbound
      ? `${baseUrl}/api/telephony/twilio/demo/gather`
      : `${baseUrl}/api/telephony/twilio/gather`;
    const languageCode = process.env.TELEPHONY_LANGUAGE_CODE || "en-IN";
    const welcomePrompt =
      (isDemoInbound
        ? process.env.TELEPHONY_DEMO_WELCOME_PROMPT
        : process.env.TELEPHONY_WELCOME_PROMPT) ||
      "Welcome to VoiceDesk AI support. Please tell me your question.";

    console.log(
      JSON.stringify({
        event: "twilio.voice.request",
        path: "/api/telephony/twilio/voice",
        isDemoInbound,
        payload: payloadEntries,
      }),
    );

    console.log(
      JSON.stringify({
        event: "twilio.voice.reply",
        actionUrl,
        languageCode,
        welcomePrompt,
      }),
    );
  } catch (error) {
    console.error("twilio voice logging failed", error);
  }

  return buildVoiceResponse();
}

export async function GET() {
  return buildVoiceResponse();
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
