function escapeXml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function twimlResponse(xmlBody: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${xmlBody}</Response>`, {
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
    },
  });
}

export function gatherSpeechTwiml(input: {
  actionUrl: string;
  prompt?: string;
  languageCode?: string;
}) {
  const prompt = escapeXml(input.prompt || "Welcome. Please tell me how I can help you.");
  const action = escapeXml(input.actionUrl);
  const languageCode = escapeXml(input.languageCode || "en-IN");

  return `
    <Gather input="speech" speechTimeout="3" action="${action}" method="POST" language="${languageCode}">
      <Say voice="alice" language="${languageCode}">${prompt}</Say>
    </Gather>
    <Say voice="alice" language="${languageCode}">I did not hear anything. Goodbye.</Say>
  `;
}

export function recordSpeechTwiml(input: {
  actionUrl: string;
  prompt?: string;
  languageCode?: string;
  maxLengthSeconds?: number;
  audioUrl?: string;
}) {
  const action = escapeXml(input.actionUrl);
  const prompt = escapeXml(input.prompt || "Please say your question after the tone.");
  const languageCode = escapeXml(input.languageCode || "en-IN");
  const maxLength = Math.max(3, Number(input.maxLengthSeconds || 20));

  const voicePart = input.audioUrl
    ? `<Play>${escapeXml(input.audioUrl)}</Play>`
    : `<Say voice="alice" language="${languageCode}">${prompt}</Say>`;

  return `
    ${voicePart}
    <Record action="${action}" method="POST" playBeep="true" timeout="3" maxLength="${maxLength}" recordingStatusCallbackMethod="POST" trim="trim-silence"/>
    <Redirect method="POST">${action}</Redirect>
  `;
}

export function playAudioOrSayTwiml(input: {
  message: string;
  actionUrl: string;
  audioUrl?: string;
  languageCode?: string;
  followupPrompt?: string;
}) {
  const message = escapeXml(input.message);
  const action = escapeXml(input.actionUrl);
  const languageCode = escapeXml(input.languageCode || "en-IN");
  const followupPrompt = escapeXml(input.followupPrompt || "You can ask another question.");

  const voicePart = input.audioUrl
    ? `<Play>${escapeXml(input.audioUrl)}</Play>`
    : `<Say voice="alice" language="${languageCode}">${message}</Say>`;

  const gatherPromptPart = input.audioUrl
    ? ""
    : `<Say voice="alice" language="${languageCode}">${followupPrompt}</Say>`;

  return `
    ${voicePart}
    <Pause length="1"/>
    <Gather input="speech" speechTimeout="3" action="${action}" method="POST" language="${languageCode}">
      ${gatherPromptPart}
    </Gather>
    <Say voice="alice" language="${languageCode}">I did not hear anything. Goodbye.</Say>
  `;
}

export function playAudioOrSayThenRecordTwiml(input: {
  message: string;
  actionUrl: string;
  audioUrl?: string;
  languageCode?: string;
  followupPrompt?: string;
  maxLengthSeconds?: number;
}) {
  const message = escapeXml(input.message);
  const action = escapeXml(input.actionUrl);
  const languageCode = escapeXml(input.languageCode || "en-IN");
  const followupPrompt = escapeXml(input.followupPrompt || "Please ask your next question after the tone.");
  const maxLength = Math.max(3, Number(input.maxLengthSeconds || 20));

  const voicePart = input.audioUrl
    ? `<Play>${escapeXml(input.audioUrl)}</Play>`
    : `<Say voice="alice" language="${languageCode}">${message}</Say>`;

  const preRecordPrompt = input.audioUrl
    ? `<Say voice="alice" language="${languageCode}">${followupPrompt}</Say>`
    : "";

  return `
    ${voicePart}
    <Pause length="1"/>
    ${preRecordPrompt}
    <Record action="${action}" method="POST" playBeep="true" timeout="3" maxLength="${maxLength}" recordingStatusCallbackMethod="POST" trim="trim-silence"/>
    <Redirect method="POST">${action}</Redirect>
  `;
}

export function escalateTwiml(input: { message: string; dialNumber?: string; languageCode?: string }) {
  const message = escapeXml(input.message);
  const languageCode = escapeXml(input.languageCode || "en-IN");
  const dialNumber = (input.dialNumber || "").trim();

  if (!dialNumber) {
    return `<Say voice="alice" language="${languageCode}">${message}</Say>`;
  }

  return `
    <Say voice="alice" language="${languageCode}">${message}</Say>
    <Dial><Number>${escapeXml(dialNumber)}</Number></Dial>
  `;
}
