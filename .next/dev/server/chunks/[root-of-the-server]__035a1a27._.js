module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/lib/telephony/twiml.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "gatherSpeechTwiml",
    ()=>gatherSpeechTwiml,
    "playAudioOrSayTwiml",
    ()=>playAudioOrSayTwiml,
    "twimlResponse",
    ()=>twimlResponse
]);
function escapeXml(input) {
    return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function twimlResponse(xmlBody) {
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${xmlBody}</Response>`, {
        headers: {
            "Content-Type": "text/xml; charset=utf-8"
        }
    });
}
function gatherSpeechTwiml(input) {
    const prompt = escapeXml(input.prompt || "Welcome to VoiceDesk. Please tell me how I can help you.");
    const action = escapeXml(input.actionUrl);
    return `
    <Gather input="speech" speechTimeout="auto" action="${action}" method="POST" language="en-IN">
      <Say voice="alice">${prompt}</Say>
    </Gather>
    <Redirect method="POST">${action}</Redirect>
  `;
}
function playAudioOrSayTwiml(input) {
    const message = escapeXml(input.message);
    const action = escapeXml(input.actionUrl);
    const voicePart = input.audioUrl ? `<Play>${escapeXml(input.audioUrl)}</Play>` : `<Say voice="alice">${message}</Say>`;
    return `
    ${voicePart}
    <Pause length="1"/>
    <Gather input="speech" speechTimeout="auto" action="${action}" method="POST" language="en-IN">
      <Say voice="alice">You can ask another question.</Say>
    </Gather>
    <Redirect method="POST">${action}</Redirect>
  `;
}
}),
"[project]/app/api/telephony/exotel/voice/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST,
    "runtime",
    ()=>runtime
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$telephony$2f$twiml$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/telephony/twiml.ts [app-route] (ecmascript)");
;
const runtime = "nodejs";
async function POST() {
    const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
    const actionUrl = `${baseUrl}/api/telephony/exotel/gather`;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$telephony$2f$twiml$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["twimlResponse"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$telephony$2f$twiml$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["gatherSpeechTwiml"])({
        actionUrl,
        prompt: "Welcome to VoiceDesk AI support. Please tell me your question."
    }));
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__035a1a27._.js.map