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
  const prompt = escapeXml(input.prompt || "Welcome to VoiceDesk. Please tell me how I can help you.");
  const action = escapeXml(input.actionUrl);
  const languageCode = escapeXml(input.languageCode || "en-IN");

  return `
    <Gather input="speech" speechTimeout="auto" action="${action}" method="POST" language="${languageCode}">
      <Say voice="alice" language="${languageCode}">${prompt}</Say>
    </Gather>
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
    <Gather input="speech" speechTimeout="auto" action="${action}" method="POST" language="${languageCode}">
      ${gatherPromptPart}
    </Gather>
    <Redirect method="POST">${action}</Redirect>
  `;
}

export function escalateTwiml(input: {
  message: string;
  phoneNumber: string;
  languageCode?: string;
}) {
  const message = escapeXml(input.message);
  const phone = escapeXml(input.phoneNumber);
  const languageCode = escapeXml(input.languageCode || "en-IN");

  return `
    <Say voice="alice" language="${languageCode}">${message}</Say>
    <Dial>${phone}</Dial>
  `;
}
