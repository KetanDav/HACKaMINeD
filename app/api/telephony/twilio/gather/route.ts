import { getDemoContextText } from "@/lib/demoContextStore";
import { getDefaultRuntimeContext } from "@/lib/telephony/context";
import {
  isDemoTwilioSignatureValid,
  isInboundToDemoNumber,
} from "@/lib/telephony/twilioDemoValidation";
import {
  getNormalizedInboundNumber,
  isAllowedProdTwilioSource,
  isProdTwilioSignatureValid,
} from "@/lib/telephony/twilioProdValidation";
import {
  escalateTwiml,
  playAudioOrSayThenRecordTwiml,
  playAudioOrSayTwiml,
  twimlResponse,
} from "@/lib/telephony/twiml";
import { loadRuntimeContextFromInboundNumber } from "@/lib/runtime/businessContext";
import { fetchTwilioRecordingBase64 } from "@/lib/telephony/twilioRecording";
import { SarvamClient } from "@/lib/sarvam/client";
import { processConversationTurn } from "@/lib/session/conversation";

export const runtime = "nodejs";

function getDefaultNoInputPrompt(languageCode: string) {
  const normalized = (languageCode || "en-IN").toLowerCase();
  if (normalized.startsWith("hi")) return "Mujhe aapki baat sahi se sunai nahi di. Kripya dobara kahiye.";
  if (normalized.startsWith("gu")) return "Mane tamari vaat spasht sambhlai nathi. Krupaya fari kahesho.";
  return "I did not catch that. Please repeat your query.";
}

function getDefaultFollowupPrompt(languageCode: string) {
  const normalized = (languageCode || "en-IN").toLowerCase();
  if (normalized.startsWith("hi")) return "Aap agla sawaal puchh sakte hain.";
  if (normalized.startsWith("gu")) return "Tame aagal no prashn puchhi shako cho.";
  return "You can ask another question.";
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
  try {
    const form = await request.formData();

    const payloadEntries = Object.fromEntries(form.entries());
    let speechResult = getSpeechFromForm(form);
    const recordingUrl = getRecordingUrlFromForm(form);
    const callSid = getCallSid(form) || `call_${Date.now()}`;
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
      getDefaultNoInputPrompt(languageCode);
    const followupPrompt =
      (isDemoInbound ? process.env.TELEPHONY_DEMO_FOLLOWUP_PROMPT : process.env.TELEPHONY_FOLLOWUP_PROMPT) ||
      getDefaultFollowupPrompt(languageCode);
    const useSarvamStt = process.env.TELEPHONY_USE_SARVAM_STT === "true" && Boolean(process.env.SARVAM_API_KEY);

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

    if (!isDemoInbound) {
      if (!isAllowedProdTwilioSource(form)) {
        return new Response("Invalid production Twilio source", { status: 403 });
      }

      if (!isProdTwilioSignatureValid(request, form)) {
        return new Response("Invalid Twilio signature", { status: 403 });
      }
    }

    if (useSarvamStt) {
      const accountSid = isDemoInbound
        ? process.env.TWILIO_DEMO_ACCOUNT_SID
        : process.env.TWILIO_PROD_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
      const authToken = isDemoInbound
        ? process.env.TWILIO_DEMO_AUTH_TOKEN
        : process.env.TWILIO_PROD_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN;

      if (recordingUrl) {
        try {
          const recording = await fetchTwilioRecordingBase64({
            recordingUrl,
            accountSid,
            authToken,
          });

          const sarvam = new SarvamClient();
          const stt = await sarvam.transcribe({
            audioBase64: recording.audioBase64,
            languageCode,
            format: "wav",
          });

          speechResult = stt.transcript;
        } catch (sttError) {
          console.error("sarvam stt failed", sttError);
        }
      } else {
        speechResult = "";
      }
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

    const runtimeContext = isDemoInbound
      ? {
          customContextText: await getDemoContextText(),
          allowedToolNames: ["search_knowledge", "get_business_info", "get_opening_hours"],
          confirmActions: [],
        }
      : {
          ...getDefaultRuntimeContext(),
          ...(await loadRuntimeContextFromInboundNumber(getNormalizedInboundNumber(form))),
          callerNumber: String(form.get("From") || "").trim() || undefined,
        };
    const conversation = await processConversationTurn({
      callSid,
      utterance: speechResult,
      context: runtimeContext,
    });

    if (conversation.shouldEscalate) {
      const escalationNumber = process.env.TELEPHONY_ESCALATION_NUMBER || "";
      return twimlResponse(
        escalateTwiml({
          message: conversation.text,
          dialNumber: escalationNumber,
          languageCode,
        }),
      );
    }

    console.log(
      JSON.stringify({
        event: "twilio.gather.runtime_result",
        utterance: speechResult,
        context: runtimeContext,
        responseText: conversation.text,
      }),
    );

    const useSarvamPlayback =
      process.env.TELEPHONY_USE_SARVAM_TTS === "true" && Boolean(process.env.SARVAM_API_KEY);
    const audioUrl = useSarvamPlayback
      ? buildSarvamPlaybackUrl(baseUrl, conversation.text, languageCode)
      : undefined;

    console.log(
      JSON.stringify({
        event: "twilio.gather.tts_reply",
        useSarvamPlayback,
        audioUrl,
        languageCode,
        fallbackSayText: conversation.text,
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
    console.error("twilio gather failed", error);
    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    const gatherAction = `${baseUrl}/api/telephony/twilio/gather`;
    const languageCode = process.env.TELEPHONY_LANGUAGE_CODE || "en-IN";

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
