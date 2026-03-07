import { runRuntimeTurn } from "@/lib/runtime/orchestrator";
import { getDemoContextText } from "@/lib/demoContextStore";
import { getDefaultRuntimeContext } from "@/lib/telephony/context";
import {
  isDemoTwilioSignatureValid,
  isInboundToDemoNumber,
} from "@/lib/telephony/twilioDemoValidation";
import { playAudioOrSayTwiml, twimlResponse } from "@/lib/telephony/twiml";

export const runtime = "nodejs";

function buildSarvamPlaybackUrl(baseUrl: string, text: string, languageCode = "en-IN") {
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
    const isDemoInbound = isInboundToDemoNumber(form);
    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    const gatherAction = isDemoInbound
      ? `${baseUrl}/api/telephony/twilio/demo/gather`
      : `${baseUrl}/api/telephony/twilio/gather`;
    const languageCode =
      (isDemoInbound ? process.env.TELEPHONY_DEMO_LANGUAGE_CODE : process.env.TELEPHONY_LANGUAGE_CODE) ||
      "en-IN";
    const noInputPrompt =
      (isDemoInbound ? process.env.TELEPHONY_DEMO_NO_INPUT_PROMPT : process.env.TELEPHONY_NO_INPUT_PROMPT) ||
      "I did not catch that. Please repeat your query.";
    const followupPrompt =
      (isDemoInbound ? process.env.TELEPHONY_DEMO_FOLLOWUP_PROMPT : process.env.TELEPHONY_FOLLOWUP_PROMPT) ||
      "You can ask another question.";

    console.log(
      JSON.stringify({
        event: "twilio.gather.request",
        path: "/api/telephony/twilio/gather",
        isDemoInbound,
        languageCode,
        payload: payloadEntries,
      }),
    );

    if (isDemoInbound && !isDemoTwilioSignatureValid(request, form)) {
      return new Response("Invalid Twilio signature", { status: 403 });
    }

    if (!speechResult) {
      console.log(
        JSON.stringify({
          event: "twilio.gather.no_input",
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

    const runtimeContext = isDemoInbound
      ? {
          customContextText: getDemoContextText(),
        }
      : getDefaultRuntimeContext();
    const runtimeResult = await runRuntimeTurn({
      utterance: speechResult,
      languageCode,
      context: runtimeContext,
    });

    console.log(
      JSON.stringify({
        event: "twilio.gather.runtime_result",
        utterance: speechResult,
        context: runtimeContext,
        intent: runtimeResult.intent,
        action: runtimeResult.action,
        slots: runtimeResult.slots,
        mcp: runtimeResult.mcp,
        responseText: runtimeResult.responseText,
      }),
    );

    const useSarvamPlayback =
      process.env.TELEPHONY_USE_SARVAM_TTS === "true" && Boolean(process.env.SARVAM_API_KEY);
    const audioUrl = useSarvamPlayback
      ? buildSarvamPlaybackUrl(baseUrl, runtimeResult.responseText, languageCode)
      : undefined;

    console.log(
      JSON.stringify({
        event: "twilio.gather.tts_reply",
        useSarvamPlayback,
        audioUrl,
        languageCode,
        fallbackSayText: runtimeResult.responseText,
      }),
    );

    return twimlResponse(
      playAudioOrSayTwiml({
        message: runtimeResult.responseText,
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
        message: "We are facing a technical issue. Please try again in a while.",
        actionUrl: gatherAction,
        languageCode,
        followupPrompt: "",
      }),
    );
  }
}
