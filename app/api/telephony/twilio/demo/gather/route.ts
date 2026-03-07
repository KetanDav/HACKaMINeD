import { playAudioOrSayTwiml, twimlResponse } from "@/lib/telephony/twiml";
import { getDemoContextText } from "@/lib/demoContextStore";
import {
  isAllowedDemoTwilioSource,
  isDemoTwilioSignatureValid,
} from "@/lib/telephony/twilioDemoValidation";
import { processConversationTurn } from "@/lib/session/conversation";

export const runtime = "nodejs";

function getDefaultNoInputPrompt(languageCode: string) {
  const normalized = (languageCode || "en-IN").toLowerCase();
  if (normalized.startsWith("hi")) return "Mujhe aapki baat sahi se sunai nahi di. Kripya dobara kahiye.";
  if (normalized.startsWith("gu")) return "Mane tamari vaat spasht sambhlai nathi. Krupaya fari kahesho.";
  return "I did not catch that. Please repeat your question.";
}

function getDefaultFollowupPrompt(languageCode: string) {
  const normalized = (languageCode || "en-IN").toLowerCase();
  if (normalized.startsWith("hi")) return "Aap agla sawaal puchh sakte hain.";
  if (normalized.startsWith("gu")) return "Tame aagal no prashn puchhi shako cho.";
  return "You can ask another question.";
}

function getBaseUrl() {
  return process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function buildSarvamPlaybackUrl(baseUrl: string, text: string, languageCode = "en-IN") {
  const url = new URL(`${baseUrl}/api/telephony/twilio/sarvam-tts`);
  url.searchParams.set("text", text);
  url.searchParams.set("languageCode", languageCode);
  return url.toString();
}

function getSpeechFromForm(form: FormData) {
  return (
    String(form.get("SpeechResult") || "").trim() ||
    String(form.get("UnstableSpeechResult") || "").trim() ||
    String(form.get("TranscriptionText") || "").trim() ||
    String(form.get("speech") || "").trim() ||
    String(form.get("query") || "").trim() ||
    String(form.get("text") || "").trim()
  );
}

function getCallSid(form: FormData) {
  return String(form.get("CallSid") || form.get("callSid") || "").trim();
}

export async function POST(request: Request) {
  const baseUrl = getBaseUrl();
  const gatherAction = `${baseUrl}/api/telephony/twilio/demo/gather`;
  const languageCode =
    process.env.TELEPHONY_DEMO_LANGUAGE_CODE || process.env.TELEPHONY_LANGUAGE_CODE || "en-IN";
  const noInputPrompt =
    process.env.TELEPHONY_DEMO_NO_INPUT_PROMPT ||
    process.env.TELEPHONY_NO_INPUT_PROMPT ||
    getDefaultNoInputPrompt(languageCode);
  const followupPrompt =
    process.env.TELEPHONY_DEMO_FOLLOWUP_PROMPT ||
    process.env.TELEPHONY_FOLLOWUP_PROMPT ||
    getDefaultFollowupPrompt(languageCode);

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

    let speechResult = getSpeechFromForm(form);
    const callSid = getCallSid(form) || `demo_call_${Date.now()}`;

    if (!speechResult) {
      return twimlResponse(
        playAudioOrSayTwiml({
          message: noInputPrompt,
          actionUrl: gatherAction,
          languageCode,
          followupPrompt,
        }),
      );
    }

    const conversation = await processConversationTurn({
      callSid,
      utterance: speechResult,
      context: {
        customContextText: await getDemoContextText(),
        allowedToolNames: ["search_knowledge", "get_business_info", "get_opening_hours"],
        confirmActions: [],
      },
    });

    const useSarvamPlayback =
      process.env.TELEPHONY_USE_SARVAM_TTS === "true" && Boolean(process.env.SARVAM_API_KEY);
    const audioUrl = useSarvamPlayback
      ? buildSarvamPlaybackUrl(baseUrl, conversation.text, languageCode)
      : undefined;

    console.log(
      JSON.stringify({
        event: "twilio.demo.gather.runtime_result",
        utterance: speechResult,
        responseText: conversation.text,
      }),
    );

    return twimlResponse(
      playAudioOrSayTwiml({
        message: conversation.text,
        actionUrl: gatherAction,
        audioUrl,
        languageCode,
        followupPrompt,
      }),
    );
  } catch (error) {
    console.error("twilio demo gather failed", error);
    return twimlResponse(
      playAudioOrSayTwiml({
        message: "We are facing a technical issue. Please try again in a while.",
        actionUrl: gatherAction,
        languageCode,
        followupPrompt: "",
      }),
    );
  }
}
