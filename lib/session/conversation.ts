/**
 * Conversation Manager — state machine for multi-turn voice calls.
 *
 * Handles: intent classification, slot filling, confirmations,
 * interruptions, fallback responses, and human escalation.
 */

import { getAIProvider } from "@/lib/ai";
import { MCPToolRouter, type RuntimeBusinessContext } from "@/lib/mcp/router";
import {
    sessionStore,
    type CallSession,
} from "@/lib/session/store";

// ── Types ──────────────────────────────────────────

export interface ConversationTurnInput {
    callSid: string;
    utterance: string;
    tenantId: string;
    callerNumber: string;
    dialedNumber: string;
    languageCode: string;
    context: RuntimeBusinessContext;
}

export interface ConversationTurnResult {
    responseText: string;
    shouldEscalate: boolean;
    escalateNumber?: string;
    intent: string;
    action: string;
    slots: Record<string, string>;
    mcp: { ok: boolean; message: string; data?: Record<string, unknown> };
}

// ── Escalation ─────────────────────────────────────

const ESCALATION_KEYWORDS = [
    "human", "agent", "person", "operator", "manager",
    "insaan", "aadmi", "koi hai",
];

const CONFIRMATION_YES = ["yes", "yeah", "yep", "confirm", "haan", "ha", "ok", "sure", "correct"];
const CONFIRMATION_NO = ["no", "nah", "nope", "cancel", "nahi", "na", "wrong"];

function isEscalationRequest(utterance: string): boolean {
    const text = utterance.toLowerCase();
    return ESCALATION_KEYWORDS.some((k) => text.includes(k));
}

function isConfirmation(utterance: string): "yes" | "no" | "unclear" {
    const text = utterance.toLowerCase().trim();
    if (CONFIRMATION_YES.some((w) => text.includes(w))) return "yes";
    if (CONFIRMATION_NO.some((w) => text.includes(w))) return "no";
    return "unclear";
}

// ── Heuristic slot extraction (fallback) ───────────

function heuristicSlotExtraction(
    utterance: string,
    requiredSlots: string[],
): Record<string, string> {
    const text = utterance.toLowerCase();
    const output: Record<string, string> = {};

    if (requiredSlots.includes("query")) {
        output.query = utterance.trim();
    }
    if (requiredSlots.includes("order_id")) {
        const match =
            text.match(/order\s*(id)?\s*[:#-]?\s*(\d{2,})/) || text.match(/\b(\d{2,})\b/);
        const candidate = match?.[2] || match?.[1];
        if (candidate) output.order_id = candidate;
    }
    if (requiredSlots.includes("date")) {
        const match = text.match(
            /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
        );
        if (match?.[1]) output.date = match[1];
    }
    if (requiredSlots.includes("time")) {
        const match = text.match(/\b(\d{1,2}(:\d{2})?\s?(am|pm)?)\b/);
        if (match?.[1]) output.time = match[1].trim();
    }
    if (requiredSlots.includes("name")) {
        const match = text.match(/my name is\s+([a-zA-Z]+)/);
        if (match?.[1]) output.name = match[1];
    }

    return output;
}

// ── Keyword intent fallback ────────────────────────

function keywordIntentFallback(utterance: string): string {
    const text = utterance.toLowerCase();
    if (text.includes("price") || text.includes("cost") || text.includes("haircut") || text.includes("beard")) {
        return "get_business_info";
    }
    if (text.includes("order")) return "get_order_status";
    if (text.includes("appointment") || text.includes("slot") || text.includes("schedule")) {
        return text.includes("book") ? "book_appointment" : "check_available_slots";
    }
    if (text.includes("open") || text.includes("timing") || text.includes("hours")) {
        return "get_opening_hours";
    }
    if (text.includes("whatsapp")) return "send_whatsapp";
    if (text.includes("email")) return "send_email";
    return "search_knowledge";
}

// Actions that require explicit confirmation before execution
const CRITICAL_ACTIONS = new Set([
    "book_appointment",
    "cancel_appointment",
    "send_whatsapp",
    "send_email",
]);

// ── Main Conversation Manager ──────────────────────

export async function processConversationTurn(
    input: ConversationTurnInput,
): Promise<ConversationTurnResult> {
    const session = sessionStore.getOrCreate({
        callSid: input.callSid,
        tenantId: input.tenantId,
        callerNumber: input.callerNumber,
        dialedNumber: input.dialedNumber,
        languageCode: input.languageCode,
    });

    // Record caller turn
    sessionStore.addTurn(input.callSid, "caller", input.utterance);

    const router = new MCPToolRouter();

    // ── Check escalation ─────────────────────────────
    if (isEscalationRequest(input.utterance)) {
        return handleEscalation(session, input);
    }

    // ── State machine dispatch ───────────────────────
    let result: ConversationTurnResult;

    switch (session.state) {
        case "CONFIRMING":
            result = await handleConfirmation(session, input, router);
            break;

        case "SLOT_FILLING":
            result = await handleSlotFilling(session, input, router);
            break;

        case "IDLE":
        case "CLASSIFYING":
        default:
            result = await handleNewUtterance(session, input, router);
            break;
    }

    // Record system turn
    sessionStore.addTurn(input.callSid, "system", result.responseText);

    return result;
}

// ── State handlers ─────────────────────────────────

function handleEscalation(
    session: CallSession,
    input: ConversationTurnInput,
): ConversationTurnResult {
    session.state = "ESCALATING";
    sessionStore.set(input.callSid, session);

    const escalateNumber =
        input.context.businessInfo?.escalationPhone ||
        process.env.ESCALATION_DEFAULT_NUMBER ||
        undefined;

    return {
        responseText: "I am connecting you to a human agent. Please hold.",
        shouldEscalate: true,
        escalateNumber,
        intent: "escalate",
        action: "escalate",
        slots: {},
        mcp: { ok: true, message: "Escalating to human agent." },
    };
}

async function handleConfirmation(
    session: CallSession,
    input: ConversationTurnInput,
    router: MCPToolRouter,
): Promise<ConversationTurnResult> {
    const answer = isConfirmation(input.utterance);

    if (answer === "yes") {
        // Execute the pending action
        return await executeToolAndRespond(session, input, router);
    }

    if (answer === "no") {
        const responseText = "Okay, I have cancelled that action. How else can I help you?";
        sessionStore.resetIntent(input.callSid);
        return {
            responseText,
            shouldEscalate: false,
            intent: session.currentIntent || "cancelled",
            action: "cancelled",
            slots: session.filledSlots,
            mcp: { ok: false, message: "Action cancelled by caller." },
        };
    }

    // Unclear confirmation — ask again
    const action = session.confirmationAction || session.currentIntent || "this action";
    return {
        responseText: `I need a clear yes or no. Should I proceed with ${action}?`,
        shouldEscalate: false,
        intent: session.currentIntent || "unknown",
        action: "awaiting_confirmation",
        slots: session.filledSlots,
        mcp: { ok: false, message: "Awaiting confirmation." },
    };
}

async function handleSlotFilling(
    session: CallSession,
    input: ConversationTurnInput,
    router: MCPToolRouter,
): Promise<ConversationTurnResult> {
    const tool = router.getToolByName(session.currentIntent || "");
    if (!tool) {
        sessionStore.resetIntent(input.callSid);
        return await handleNewUtterance(session, input, router);
    }

    // Fast keyword check for cancel/restart (no LLM needed)
    const textLower = input.utterance.toLowerCase().trim();
    const cancelKeywords = ["cancel", "stop", "start over", "restart", "never mind", "nahi", "band karo"];
    if (cancelKeywords.some((k) => textLower.includes(k))) {
        sessionStore.resetIntent(input.callSid);
        return {
            responseText: "Okay, I have cancelled that. How else can I help you?",
            shouldEscalate: false,
            intent: session.currentIntent || "cancelled",
            action: "cancelled",
            slots: {},
            mcp: { ok: false, message: "Action cancelled by caller." },
        };
    }

    // Treat the utterance as the value for the first missing slot
    const firstMissing = session.missingSlots[0];
    if (firstMissing) {
        // Try heuristic extraction first (instant), then AI, fallback to raw text
        let slotValue = input.utterance.trim();
        const heuristic = heuristicSlotExtraction(input.utterance, [firstMissing]);
        if (heuristic[firstMissing]) {
            slotValue = heuristic[firstMissing];
        } else {
            try {
                const ai = getAIProvider();
                const extracted = await ai.extractSlots({
                    utterance: input.utterance,
                    requiredSlots: [firstMissing],
                });
                if (extracted[firstMissing]) {
                    slotValue = extracted[firstMissing];
                }
            } catch {
                // Use raw utterance as slot value
            }
        }

        session.filledSlots[firstMissing] = slotValue;
        session.missingSlots = session.missingSlots.filter((s) => s !== firstMissing);
    }

    // Check if all slots are now filled
    if (session.missingSlots.length === 0) {
        // All slots filled → confirm or execute
        if (CRITICAL_ACTIONS.has(session.currentIntent || "")) {
            session.state = "CONFIRMING";
            session.awaitingConfirmation = true;
            session.confirmationAction = session.currentIntent;
            sessionStore.set(input.callSid, session);

            const confirmText = buildConfirmationPrompt(session);
            return {
                responseText: confirmText,
                shouldEscalate: false,
                intent: session.currentIntent || "unknown",
                action: "awaiting_confirmation",
                slots: session.filledSlots,
                mcp: { ok: false, message: "Awaiting confirmation." },
            };
        }

        return await executeToolAndRespond(session, input, router);
    }

    // Still missing slots — ask for the next one
    const nextMissing = session.missingSlots[0];
    const prompt =
        tool.missingSlotPrompts[nextMissing] ||
        `Please share ${nextMissing.replace(/_/g, " ")}.`;

    session.state = "SLOT_FILLING";
    sessionStore.set(input.callSid, session);

    return {
        responseText: prompt,
        shouldEscalate: false,
        intent: session.currentIntent || "unknown",
        action: tool.name,
        slots: session.filledSlots,
        mcp: { ok: false, message: `Waiting for ${nextMissing}.` },
    };
}

async function handleNewUtterance(
    session: CallSession,
    input: ConversationTurnInput,
    router: MCPToolRouter,
): Promise<ConversationTurnResult> {
    const ai = getAIProvider();
    const tools = router.getTools();
    const allowedIntents = tools.map((t) => t.name);

    let intent = "get_business_info";
    let confidence = 0;
    let slots: Record<string, string> = {};

    // ── Intent classification ────────────────────────
    try {
        const result = await ai.classifyIntent({
            utterance: input.utterance,
            allowedIntents,
        });
        intent = allowedIntents.includes(result.intent)
            ? result.intent
            : keywordIntentFallback(input.utterance);
        confidence = result.confidence;
        slots = result.slots || {};
    } catch {
        intent = keywordIntentFallback(input.utterance);
        confidence = 0;
        slots = {};
    }

    // ── Low confidence → escalate ────────────────────
    if (confidence > 0 && confidence < 0.4) {
        return handleEscalation(session, input);
    }

    // ── KB fallback ──────────────────────────────────
    if (intent === "search_knowledge" && !input.context.knowledgeBaseId) {
        intent = "get_business_info";
    }

    const tool = router.getToolByName(intent) || router.getToolByName("get_business_info");
    if (!tool) {
        return {
            responseText: "I could not process this request right now.",
            shouldEscalate: false,
            intent: "unknown",
            action: "none",
            slots: {},
            mcp: { ok: false, message: "Tool router unavailable." },
        };
    }

    // ── Slot extraction ──────────────────────────────
    // Merge heuristic + AI extraction
    const heuristicSlots = heuristicSlotExtraction(input.utterance, tool.requiredSlots);
    slots = { ...slots, ...heuristicSlots };

    const missing = tool.requiredSlots.filter((s) => !slots[s]);
    if (missing.length > 0) {
        // Try AI extraction for remaining
        try {
            const extracted = await ai.extractSlots({
                utterance: input.utterance,
                requiredSlots: missing,
            });
            slots = { ...slots, ...extracted };
        } catch {
            // Keep what we have
        }
    }

    // ── Update session ───────────────────────────────
    session.currentIntent = intent;
    session.filledSlots = slots;
    session.missingSlots = tool.requiredSlots.filter((s) => !slots[s]);

    if (session.missingSlots.length > 0) {
        // Need more slots
        session.state = "SLOT_FILLING";
        sessionStore.set(input.callSid, session);

        const nextMissing = session.missingSlots[0];
        const prompt =
            tool.missingSlotPrompts[nextMissing] ||
            `Please share ${nextMissing.replace(/_/g, " ")}.`;

        return {
            responseText: prompt,
            shouldEscalate: false,
            intent,
            action: tool.name,
            slots: session.filledSlots,
            mcp: { ok: false, message: `Waiting for ${nextMissing}.` },
        };
    }

    // All slots filled
    if (CRITICAL_ACTIONS.has(intent)) {
        session.state = "CONFIRMING";
        session.awaitingConfirmation = true;
        session.confirmationAction = intent;
        sessionStore.set(input.callSid, session);

        const confirmText = buildConfirmationPrompt(session);
        return {
            responseText: confirmText,
            shouldEscalate: false,
            intent,
            action: "awaiting_confirmation",
            slots: session.filledSlots,
            mcp: { ok: false, message: "Awaiting confirmation." },
        };
    }

    return await executeToolAndRespond(session, input, router);
}

// ── Helpers ────────────────────────────────────────

async function executeToolAndRespond(
    session: CallSession,
    input: ConversationTurnInput,
    router: MCPToolRouter,
): Promise<ConversationTurnResult> {
    const intent = session.currentIntent || "get_business_info";
    const slots = session.filledSlots;

    const execution = await router.execute(intent, slots, input.context);

    // Reset session intent after execution
    sessionStore.resetIntent(input.callSid);

    return {
        responseText: execution.message,
        shouldEscalate: false,
        intent,
        action: intent,
        slots,
        mcp: {
            ok: execution.ok,
            message: execution.message,
            data: execution.data,
        },
    };
}

function buildConfirmationPrompt(session: CallSession): string {
    const intent = session.currentIntent || "action";
    const slots = session.filledSlots;

    switch (intent) {
        case "book_appointment":
            return `Just to confirm: book an appointment for ${slots.name || "you"} on ${slots.date || "the requested date"} at ${slots.time || "the requested time"}. Should I go ahead?`;
        case "send_whatsapp":
            return `I will send a WhatsApp message to ${slots.phone || "the number"}. Should I proceed?`;
        case "send_email":
            return `I will send an email to ${slots.to || "the address"} with subject "${slots.subject || ""}". Should I proceed?`;
        default:
            return `Should I proceed with ${intent}?`;
    }
}
