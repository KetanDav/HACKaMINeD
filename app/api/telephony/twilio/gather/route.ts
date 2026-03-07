import { processConversationTurn } from "@/lib/session/conversation";
import { loadTenantContext } from "@/lib/telephony/context";
import {
  escalateTwiml,
  playAudioOrSayTwiml,
  twimlResponse,
} from "@/lib/telephony/twiml";

export const runtime = "nodejs";

function buildSarvamPlaybackUrl(
  baseUrl: string,
  text: string,
  languageCode = "en-IN",
) {
  const url = new URL(`${baseUrl}/api/telephony/twilio/sarvam-tts`);
  url.searchParams.set("text", text);
  url.searchParams.set("languageCode", languageCode);
  return url.toString();
}

function getSpeechFromForm(form: FormData) {
  return (
    String(form.get("SpeechResult") || "").trim() ||
    String(form.get("speech") || "").trim() ||
    String(form.get("query") || "").trim() ||
    String(form.get("text") || "").trim()
  );
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const payloadEntries = Object.fromEntries(form.entries());
    const speechResult = getSpeechFromForm(form);
    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    const gatherAction = `${baseUrl}/api/telephony/twilio/gather`;
    const languageCode = process.env.TELEPHONY_LANGUAGE_CODE || "en-IN";
    const noInputPrompt =
      process.env.TELEPHONY_NO_INPUT_PROMPT ||
      "I did not catch that. Please repeat your query.";
    const followupPrompt =
      process.env.TELEPHONY_FOLLOWUP_PROMPT || "You can ask another question.";

    // Extract Twilio metadata
    const callSid = String(form.get("CallSid") || `local_${Date.now()}`);
    const callerNumber = String(form.get("From") || "unknown");
    const dialedNumber = String(form.get("To") || "unknown");

    console.log(
      JSON.stringify({
        event: "twilio.gather.request",
        path: "/api/telephony/twilio/gather",
        callSid,
        callerNumber,
        languageCode,
        payload: payloadEntries,
      }),
    );

    if (!speechResult) {
      console.log(
        JSON.stringify({
          event: "twilio.gather.no_input",
          callSid,
          prompt: noInputPrompt,
          actionUrl: gatherAction,
        }),
      );

      return twimlResponse(
        playAudioOrSayTwiml({
          message: noInputPrompt,
          actionUrl: gatherAction,
          languageCode,
          followupPrompt,
        }),
      );
    }

    // ── Use Conversation Manager (session-aware) ───
    const { tenantId, context: runtimeContext } = await loadTenantContext(dialedNumber);
    const result = await processConversationTurn({
      callSid,
      utterance: speechResult,
      tenantId,
      callerNumber,
      dialedNumber,
      languageCode,
      context: runtimeContext,
    });

    console.log(
      JSON.stringify({
        event: "twilio.gather.conversation_result",
        callSid,
        utterance: speechResult,
        intent: result.intent,
        action: result.action,
        slots: result.slots,
        mcp: result.mcp,
        shouldEscalate: result.shouldEscalate,
        responseText: result.responseText,
      }),
    );

    // ── Handle escalation ──────────────────────────
    if (result.shouldEscalate && result.escalateNumber) {
      return twimlResponse(
        escalateTwiml({
          message: result.responseText,
          phoneNumber: result.escalateNumber,
          languageCode,
        }),
      );
    }

    // ── Normal response ────────────────────────────
    const useSarvamPlayback =
      process.env.TELEPHONY_USE_SARVAM_TTS === "true" &&
      Boolean(process.env.SARVAM_API_KEY);
    const audioUrl = useSarvamPlayback
      ? buildSarvamPlaybackUrl(baseUrl, result.responseText, languageCode)
      : undefined;

    return twimlResponse(
      playAudioOrSayTwiml({
        message: result.responseText,
        actionUrl: gatherAction,
        audioUrl,
        languageCode,
        followupPrompt,
      }),
    );
  } catch (error) {
    console.error("twilio gather failed", error);
    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    const gatherAction = `${baseUrl}/api/telephony/twilio/gather`;
    const languageCode = process.env.TELEPHONY_LANGUAGE_CODE || "en-IN";

    return twimlResponse(
      playAudioOrSayTwiml({
        message:
          "We are facing a technical issue. Please try again in a while.",
        actionUrl: gatherAction,
        languageCode,
        followupPrompt: "",
      }),
    );
  }
}
