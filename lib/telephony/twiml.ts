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

  if (input.audioUrl) {
    // Sarvam TTS: Play the audio, then open a silent Gather for the next turn
    return `
    <Play>${escapeXml(input.audioUrl)}</Play>
    <Gather input="speech" speechTimeout="auto" action="${action}" method="POST" language="${languageCode}">
    </Gather>
    <Redirect method="POST">${action}</Redirect>
  `;
  }

  // Twilio built-in TTS: Speak the AI response INSIDE the Gather tag
  // so the caller can interrupt (barge-in) and there is no separate
  // "You can ask another question" line appended.
  return `
    <Gather input="speech" speechTimeout="auto" action="${action}" method="POST" language="${languageCode}">
      <Say voice="alice" language="${languageCode}">${message}</Say>
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
  const callerId = escapeXml(process.env.TWILIO_PHONE_NUMBER || "");

  return `
    <Say voice="alice" language="${languageCode}">${message}</Say>
    <Dial${callerId ? ` callerId="${callerId}"` : ""} timeout="30">
      <Number>${phone}</Number>
    </Dial>
    <Say voice="alice" language="${languageCode}">The agent is not available right now. Please try again later. Goodbye.</Say>
  `;
}
