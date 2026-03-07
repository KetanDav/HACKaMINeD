import { getAIProvider } from "@/lib/ai";
import { MCPToolRouter, type RuntimeBusinessContext } from "@/lib/mcp/router";
import { runRuntimeTurn } from "@/lib/runtime/orchestrator";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { clearSession, getOrCreateSession, saveSession } from "./store";

type ProcessTurnInput = {
  callSid: string;
  utterance: string;
  context: RuntimeBusinessContext;
};

type ProcessTurnOutput = {
  text: string;
  shouldEscalate?: boolean;
};

function isCancelIntent(text: string) {
  const normalized = text.toLowerCase();
  return normalized.includes("cancel") || normalized.includes("stop") || normalized.includes("nevermind");
}

function isEscalationIntent(text: string) {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("human") ||
    normalized.includes("agent") ||
    normalized.includes("representative") ||
    normalized.includes("customer care")
  );
}

function isYes(text: string) {
  const normalized = text.toLowerCase();
  return ["yes", "y", "confirm", "ok", "go ahead", "sure"].some((token) => normalized.includes(token));
}

function isNo(text: string) {
  const normalized = text.toLowerCase();
  return ["no", "n", "cancel", "stop", "don't"].some((token) => normalized.includes(token));
}

function mergeSlots(base: Record<string, string>, extra: Record<string, string>) {
  return {
    ...base,
    ...Object.fromEntries(Object.entries(extra).filter(([, value]) => String(value || "").trim())),
  };
}

function isBookingIntent(text: string) {
  const normalized = text.toLowerCase();
  const hasBook = normalized.includes("book") || normalized.includes("booking") || normalized.includes("schedule");
  const hasAppointmentWord =
    normalized.includes("appointment") ||
    normalized.includes("appoint") ||
    normalized.includes("apoit") ||
    normalized.includes("apointment") ||
    normalized.includes("slot");
  return hasBook && hasAppointmentWord;
}

function extractNameFromText(utterance: string) {
  const raw = utterance.trim();
  const match = raw.match(/(?:my\s+name\s+is|name\s+is|this\s+is)\s+([a-zA-Z][a-zA-Z\s]{1,40})/i);
  if (!match?.[1]) return "";
  return match[1].trim().replace(/\s+/g, " ");
}

function extractTimeFromText(utterance: string) {
  const lower = utterance.toLowerCase();
  const ampm = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (ampm) {
    let hour = Number(ampm[1]);
    const minute = Number(ampm[2] || "0");
    const suffix = String(ampm[3]).toLowerCase();
    if (hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59) {
      if (suffix === "pm" && hour !== 12) hour += 12;
      if (suffix === "am" && hour === 12) hour = 0;
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
  }

  const hhmm = lower.match(/\b(\d{1,2}):(\d{2})\b/);
  if (hhmm) {
    const hour = Number(hhmm[1]);
    const minute = Number(hhmm[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
  }

  return "";
}

function parseMonthFromName(name: string) {
  const key = name.toLowerCase().slice(0, 3);
  const months: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };
  return months[key] || 0;
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function extractDateFromText(utterance: string) {
  const lower = utterance.toLowerCase();
  const now = new Date();

  if (/\btoday\b/.test(lower)) {
    return toIsoDate(now);
  }

  if (/\btomorrow\b/.test(lower)) {
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    return toIsoDate(next);
  }

  const slash = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const yearRaw = slash[3] ? Number(slash[3]) : now.getFullYear();
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const ordinalWithMonth = lower.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/i,
  );
  if (ordinalWithMonth) {
    const day = Number(ordinalWithMonth[1]);
    const month = parseMonthFromName(ordinalWithMonth[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${now.getFullYear()}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const ordinalOnly = lower.match(/\b(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)\b/);
  if (ordinalOnly) {
    const day = Number(ordinalOnly[1]);
    if (day >= 1 && day <= 31) {
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return "";
}

async function getHardcodedDoctorContext(baseContext: RuntimeBusinessContext): Promise<RuntimeBusinessContext> {
  const doctorBusinessProfileId = process.env.CALLIFY_DOCTOR_BUSINESS_PROFILE_ID || "";
  if (doctorBusinessProfileId) {
    return {
      ...baseContext,
      businessProfileId: doctorBusinessProfileId,
    };
  }

  const doctorEmail = (process.env.CALLIFY_DOCTOR_EMAIL || "doctor@callify.app").toLowerCase();
  const admin = getSupabaseAdmin();

  const { data: doctorUser } = await admin.auth.admin.listUsers();
  const match = doctorUser.users.find((user) => (user.email || "").toLowerCase() === doctorEmail);
  if (!match?.id) {
    return baseContext;
  }

  const { data: profile } = await admin
    .from("business_profiles")
    .select("id, business_name")
    .eq("user_id", match.id)
    .maybeSingle<{ id: string; business_name: string }>();

  if (!profile?.id) {
    return baseContext;
  }

  return {
    ...baseContext,
    businessProfileId: profile.id,
    businessInfo: {
      ...(baseContext.businessInfo || {}),
      name: profile.business_name || baseContext.businessInfo?.name || "Doctor Calendar",
    },
  };
}

function inferSlotsFromText(utterance: string, requiredSlots: string[]) {
  const text = utterance.toLowerCase();
  const output: Record<string, string> = {};

  if (requiredSlots.includes("query")) {
    output.query = utterance.trim();
  }

  if (requiredSlots.includes("order_id")) {
    const orderMatch = text.match(/order\s*(id)?\s*[:#-]?\s*(\d{2,})/) || text.match(/\b(\d{2,})\b/);
    const candidate = orderMatch?.[2] || orderMatch?.[1];
    if (candidate) output.order_id = candidate;
  }

  if (requiredSlots.includes("date")) {
    const dateMatch = text.match(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    if (dateMatch?.[1]) output.date = dateMatch[1];
  }

  if (requiredSlots.includes("time")) {
    const timeMatch = text.match(/\b(\d{1,2}(:\d{2})?\s?(am|pm)?)\b/);
    if (timeMatch?.[1]) output.time = timeMatch[1].trim();
  }

  if (requiredSlots.includes("name")) {
    const nameMatch = text.match(/my name is\s+([a-zA-Z]+)/);
    if (nameMatch?.[1]) output.name = nameMatch[1];
  }

  return output;
}

export async function processConversationTurn(input: ProcessTurnInput): Promise<ProcessTurnOutput> {
  const session = getOrCreateSession(input.callSid, input.context);
  session.turnHistory.push({ role: "user", text: input.utterance, timestamp: new Date().toISOString() });

  if (isCancelIntent(input.utterance) && (session.state === "SLOT_FILLING" || session.state === "CONFIRMING")) {
    session.state = "IDLE";
    session.currentIntent = undefined;
    session.filledSlots = {};
    session.missingSlots = [];
    saveSession(session);
    return { text: "Okay, I cancelled that request. How else can I help?" };
  }

  if (isEscalationIntent(input.utterance)) {
    session.state = "ESCALATING";
    saveSession(session);
    return {
      text: "I will transfer you to a human support agent now.",
      shouldEscalate: true,
    };
  }

  // Deterministic appointment booking path without model dependency.
  if (isBookingIntent(input.utterance)) {
    const parsedName = extractNameFromText(input.utterance);
    const parsedDate = extractDateFromText(input.utterance);
    const parsedTime = extractTimeFromText(input.utterance);

    if (!parsedName) {
      const prompt = "Please tell me your name for booking.";
      session.turnHistory.push({ role: "assistant", text: prompt, timestamp: new Date().toISOString() });
      saveSession(session);
      return { text: prompt };
    }

    if (!parsedDate) {
      const prompt = "Please tell me the appointment date, for example 2026-03-05 or 5th March.";
      session.turnHistory.push({ role: "assistant", text: prompt, timestamp: new Date().toISOString() });
      saveSession(session);
      return { text: prompt };
    }

    if (!parsedTime) {
      const prompt = "Please tell me the appointment time, for example 4 PM.";
      session.turnHistory.push({ role: "assistant", text: prompt, timestamp: new Date().toISOString() });
      saveSession(session);
      return { text: prompt };
    }

    const doctorContext = await getHardcodedDoctorContext(session.context);
    const router = new MCPToolRouter(doctorContext.customTools || []);
    const result = await router.execute(
      "book_appointment",
      {
        name: parsedName,
        date: parsedDate,
        time: parsedTime,
      },
      doctorContext,
    );

    session.state = "IDLE";
    session.currentIntent = undefined;
    session.filledSlots = {};
    session.missingSlots = [];
    session.turnHistory.push({ role: "assistant", text: result.message, timestamp: new Date().toISOString() });
    saveSession(session);
    return { text: result.message };
  }

  if (session.state === "CONFIRMING" && session.currentIntent) {
    if (isYes(input.utterance)) {
      session.state = "EXECUTING";
      const router = new MCPToolRouter(session.context.customTools || []);
      const result = await router.execute(session.currentIntent, session.filledSlots, session.context);
      session.state = "IDLE";
      session.currentIntent = undefined;
      session.filledSlots = {};
      session.missingSlots = [];
      session.turnHistory.push({ role: "assistant", text: result.message, timestamp: new Date().toISOString() });
      saveSession(session);
      return { text: result.message };
    }

    if (isNo(input.utterance)) {
      session.state = "IDLE";
      session.currentIntent = undefined;
      session.filledSlots = {};
      session.missingSlots = [];
      saveSession(session);
      return { text: "Understood. I did not perform that action." };
    }

    saveSession(session);
    return { text: "Please confirm with yes or no." };
  }

  if (session.state === "SLOT_FILLING" && session.currentIntent) {
    const router = new MCPToolRouter(session.context.customTools || []);
    const tool = router.getToolByName(session.currentIntent);

    if (!tool) {
      session.state = "IDLE";
      session.currentIntent = undefined;
      session.filledSlots = {};
      session.missingSlots = [];
      saveSession(session);
      return { text: "I could not continue the previous request. Please ask again." };
    }

    const ai = getAIProvider();
    const required = tool.requiredSlots.filter((slot) => !session.filledSlots[slot]);

    const heuristic = inferSlotsFromText(input.utterance, required);
    let extracted: Record<string, string> = {};
    try {
      extracted = await ai.extractSlots({ utterance: input.utterance, requiredSlots: required });
    } catch {
      extracted = {};
    }

    session.filledSlots = mergeSlots(session.filledSlots, mergeSlots(heuristic, extracted));
    const missing = tool.requiredSlots.filter((slot) => !session.filledSlots[slot]);

    if (missing.length > 0) {
      session.missingSlots = missing;
      session.state = "SLOT_FILLING";
      const prompt = tool.missingSlotPrompts[missing[0]] || `Please share ${missing[0]}.`;
      session.turnHistory.push({ role: "assistant", text: prompt, timestamp: new Date().toISOString() });
      saveSession(session);
      return { text: prompt };
    }

    const requiresConfirm = new Set(session.context.confirmActions || []).has(tool.name);
    if (requiresConfirm) {
      session.state = "CONFIRMING";
      const summary = Object.entries(session.filledSlots)
        .map(([key, value]) => `${key.replace(/_/g, " ")}: ${value}`)
        .join(", ");
      const prompt = `Please confirm. Should I proceed with ${tool.name.replace(/_/g, " ")} using ${summary}?`;
      session.turnHistory.push({ role: "assistant", text: prompt, timestamp: new Date().toISOString() });
      saveSession(session);
      return { text: prompt };
    }

    session.state = "EXECUTING";
    const result = await router.execute(tool.name, session.filledSlots, session.context);
    session.state = "IDLE";
    session.currentIntent = undefined;
    session.filledSlots = {};
    session.missingSlots = [];
    session.turnHistory.push({ role: "assistant", text: result.message, timestamp: new Date().toISOString() });
    saveSession(session);
    return { text: result.message };
  }

  const threshold = Number(process.env.RUNTIME_CONFIDENCE_THRESHOLD || 0.45);
  const runtimeResult = await runRuntimeTurn({
    utterance: input.utterance,
    context: {
      ...session.context,
      confirmActions: session.context.confirmActions || ["book_appointment"],
    },
  });

  if (runtimeResult.confidence > 0 && runtimeResult.confidence < threshold) {
    const text = "I want to be accurate. Could you please rephrase that request?";
    session.turnHistory.push({ role: "assistant", text, timestamp: new Date().toISOString() });
    saveSession(session);
    return { text };
  }

  if (runtimeResult.needsConfirmation) {
    session.state = "CONFIRMING";
    session.currentIntent = runtimeResult.action;
    session.filledSlots = runtimeResult.slots;
    session.missingSlots = [];
    const prompt = runtimeResult.prompt || "Please confirm with yes or no.";
    session.turnHistory.push({ role: "assistant", text: prompt, timestamp: new Date().toISOString() });
    saveSession(session);
    return { text: prompt };
  }

  if (runtimeResult.requiresInput) {
    const router = new MCPToolRouter(session.context.customTools || []);
    const tool = router.getToolByName(runtimeResult.action);
    const missing = tool ? tool.requiredSlots.filter((slot) => !runtimeResult.slots[slot]) : [];

    session.state = "SLOT_FILLING";
    session.currentIntent = runtimeResult.action;
    session.filledSlots = runtimeResult.slots;
    session.missingSlots = missing;
    const prompt = runtimeResult.prompt || (missing[0] ? `Please share ${missing[0]}.` : "Please continue.");
    session.turnHistory.push({ role: "assistant", text: prompt, timestamp: new Date().toISOString() });
    saveSession(session);
    return { text: prompt };
  }

  session.state = "IDLE";
  session.currentIntent = undefined;
  session.filledSlots = {};
  session.missingSlots = [];
  session.turnHistory.push({ role: "assistant", text: runtimeResult.responseText, timestamp: new Date().toISOString() });
  saveSession(session);
  return { text: runtimeResult.responseText };
}

export function endConversation(callSid: string) {
  clearSession(callSid);
}
