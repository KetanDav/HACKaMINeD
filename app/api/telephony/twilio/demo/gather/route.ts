import { runRuntimeTurn } from "@/lib/runtime/orchestrator";
import { playAudioOrSayTwiml, twimlResponse } from "@/lib/telephony/twiml";
import { getDemoContextText } from "@/lib/demoContextStore";
import {
  isAllowedDemoTwilioSource,
  isDemoTwilioSignatureValid,
} from "@/lib/telephony/twilioDemoValidation";

export const runtime = "nodejs";

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
    String(form.get("speech") || "").trim() ||
    String(form.get("query") || "").trim() ||
    String(form.get("text") || "").trim()
  );
}

export async function POST(request: Request) {
  const baseUrl = getBaseUrl();
  const gatherAction = `${baseUrl}/api/telephony/twilio/demo/gather`;
  const languageCode =
    process.env.TELEPHONY_DEMO_LANGUAGE_CODE || process.env.TELEPHONY_LANGUAGE_CODE || "en-IN";
  const noInputPrompt =
    process.env.TELEPHONY_DEMO_NO_INPUT_PROMPT ||
    process.env.TELEPHONY_NO_INPUT_PROMPT ||
    "I did not catch that. Please repeat your question.";
  const followupPrompt =
    process.env.TELEPHONY_DEMO_FOLLOWUP_PROMPT ||
    process.env.TELEPHONY_FOLLOWUP_PROMPT ||
    "You can ask another question.";

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

    const speechResult = getSpeechFromForm(form);

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

    const runtimeResult = await runRuntimeTurn({
      utterance: speechResult,
      languageCode,
      context: {
        customContextText: getDemoContextText(),
      },
    });

    const useSarvamPlayback =
      process.env.TELEPHONY_USE_SARVAM_TTS === "true" && Boolean(process.env.SARVAM_API_KEY);
    const audioUrl = useSarvamPlayback
      ? buildSarvamPlaybackUrl(baseUrl, runtimeResult.responseText, languageCode)
      : undefined;

    console.log(
      JSON.stringify({
        event: "twilio.demo.gather.runtime_result",
        utterance: speechResult,
        responseText: runtimeResult.responseText,
        intent: runtimeResult.intent,
        action: runtimeResult.action,
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
