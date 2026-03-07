import { playAudioOrSayThenRecordTwiml, playAudioOrSayTwiml, twimlResponse } from "@/lib/telephony/twiml";
import { getDemoContextText } from "@/lib/demoContextStore";
import {
  isAllowedDemoTwilioSource,
  isDemoTwilioSignatureValid,
} from "@/lib/telephony/twilioDemoValidation";
import { fetchTwilioRecordingBase64 } from "@/lib/telephony/twilioRecording";
import { SarvamClient } from "@/lib/sarvam/client";
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
    String(form.get("speech") || "").trim() ||
    String(form.get("query") || "").trim() ||
    String(form.get("text") || "").trim()
  );
}

function getRecordingUrlFromForm(form: FormData) {
  return String(form.get("RecordingUrl") || "").trim();
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
    const recordingUrl = getRecordingUrlFromForm(form);
    const callSid = getCallSid(form) || `demo_call_${Date.now()}`;
    const useSarvamStt = process.env.TELEPHONY_USE_SARVAM_STT === "true" && Boolean(process.env.SARVAM_API_KEY);

    if (useSarvamStt) {
      if (recordingUrl) {
        try {
          const recording = await fetchTwilioRecordingBase64({
            recordingUrl,
            accountSid: process.env.TWILIO_DEMO_ACCOUNT_SID,
            authToken: process.env.TWILIO_DEMO_AUTH_TOKEN,
          });

          const sarvam = new SarvamClient();
          const stt = await sarvam.transcribe({
            audioBase64: recording.audioBase64,
            languageCode,
            format: "wav",
          });
          speechResult = stt.transcript;
        } catch (sttError) {
          console.error("sarvam demo stt failed", sttError);
        }
      } else {
        speechResult = "";
      }
    }

    if (!speechResult) {
      return twimlResponse(
        useSarvamStt
          ? playAudioOrSayThenRecordTwiml({
              message: noInputPrompt,
              actionUrl: gatherAction,
              languageCode,
              followupPrompt,
            })
          : playAudioOrSayTwiml({
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
      useSarvamStt
        ? playAudioOrSayThenRecordTwiml({
            message: conversation.text,
            actionUrl: gatherAction,
            audioUrl,
            languageCode,
            followupPrompt,
          })
        : playAudioOrSayTwiml({
            message: conversation.text,
            actionUrl: gatherAction,
            audioUrl,
            languageCode,
            followupPrompt,
          }),
    );
  } catch (error) {
    console.error("twilio demo gather failed", error);
    const useSarvamStt = process.env.TELEPHONY_USE_SARVAM_STT === "true" && Boolean(process.env.SARVAM_API_KEY);
    return twimlResponse(
      useSarvamStt
        ? playAudioOrSayThenRecordTwiml({
            message: "We are facing a technical issue. Please try again in a while.",
            actionUrl: gatherAction,
            languageCode,
            followupPrompt: "",
          })
        : playAudioOrSayTwiml({
            message: "We are facing a technical issue. Please try again in a while.",
            actionUrl: gatherAction,
            languageCode,
            followupPrompt: "",
          }),
    );
  }
}
