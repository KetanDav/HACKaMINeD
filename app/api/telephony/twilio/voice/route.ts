import { gatherSpeechTwiml, recordSpeechTwiml, twimlResponse } from "@/lib/telephony/twiml";
import { isInboundToDemoNumber } from "@/lib/telephony/twilioDemoValidation";
import { isAllowedProdTwilioSource, isProdTwilioSignatureValid } from "@/lib/telephony/twilioProdValidation";
import { loadRuntimeContextFromInboundNumber } from "@/lib/runtime/businessContext";

export const runtime = "nodejs";

function defaultWelcomeByLanguage(languageCode: string, companyName: string) {
  const normalized = (languageCode || "en-IN").toLowerCase();
  if (normalized.startsWith("hi")) {
    return `${companyName} me aapka swagat hai. Kripya apna sawaal batayein.`;
  }
  if (normalized.startsWith("gu")) {
    return `${companyName} ma tamaru swagat chhe. Krupaya tamaro prashn kahesho.`;
  }
  return `Welcome to ${companyName}. Please tell me your question.`;
}

function buildVoiceResponse({
  actionUrl,
  languageCode,
  welcomePrompt,
}: {
  actionUrl: string;
  languageCode: string;
  welcomePrompt: string;
}) {
  const useSarvamStt = process.env.TELEPHONY_USE_SARVAM_STT === "true" && Boolean(process.env.SARVAM_API_KEY);

  return twimlResponse(
    useSarvamStt
      ? recordSpeechTwiml({
          actionUrl,
          prompt: welcomePrompt,
          languageCode,
          maxLengthSeconds: Number(process.env.TELEPHONY_RECORD_MAX_SECONDS || 20),
        })
      : gatherSpeechTwiml({
          actionUrl,
          prompt: welcomePrompt,
          languageCode,
        }),
  );
}

export async function POST(request: Request) {
  let isDemoInbound = false;
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  let actionUrl = `${baseUrl}/api/telephony/twilio/gather`;
  let languageCode = process.env.TELEPHONY_LANGUAGE_CODE || "en-IN";
  let welcomePrompt = process.env.TELEPHONY_WELCOME_PROMPT || "Welcome to Callify. Please tell me your question.";

  try {
    const form = await request.formData();
    isDemoInbound = isInboundToDemoNumber(form);

    if (!isDemoInbound) {
      if (!isAllowedProdTwilioSource(form)) {
        return new Response("Invalid production Twilio source", { status: 403 });
      }

      if (!isProdTwilioSignatureValid(request, form)) {
        return new Response("Invalid Twilio signature", { status: 403 });
      }
    }

    const payloadEntries = Object.fromEntries(form.entries());
    actionUrl = isDemoInbound
      ? `${baseUrl}/api/telephony/twilio/demo/gather`
      : `${baseUrl}/api/telephony/twilio/gather`;
    languageCode =
      (isDemoInbound ? process.env.TELEPHONY_DEMO_LANGUAGE_CODE : process.env.TELEPHONY_LANGUAGE_CODE) ||
      "en-IN";

    const toNumber = String(form.get("To") || "").trim();
    const runtimeContext = !isDemoInbound && toNumber
      ? await loadRuntimeContextFromInboundNumber(toNumber)
      : {};
    const companyName = runtimeContext.businessInfo?.name?.trim() || "Callify";

    welcomePrompt =
      (isDemoInbound
        ? process.env.TELEPHONY_DEMO_WELCOME_PROMPT
        : process.env.TELEPHONY_WELCOME_PROMPT) ||
      (isDemoInbound
        ? "Welcome to the demo line. Please ask your question."
        : defaultWelcomeByLanguage(languageCode, companyName));

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

  return buildVoiceResponse({ actionUrl, languageCode, welcomePrompt });
}

export async function GET() {
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  return buildVoiceResponse({
    actionUrl: `${baseUrl}/api/telephony/twilio/gather`,
    languageCode: process.env.TELEPHONY_LANGUAGE_CODE || "en-IN",
    welcomePrompt: process.env.TELEPHONY_WELCOME_PROMPT || "Welcome to Callify. Please tell me your question.",
  });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
