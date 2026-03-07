/**
 * Session Store for multi-turn voice conversations.
 *
 * Uses Twilio CallSid as the session key.
 * MVP: in-memory Map (acceptable for long-lived dev server).
 * Production: swap for Redis/Upstash with same interface.
 */

export interface CallSessionTurn {
    role: "caller" | "system";
    text: string;
    timestamp: number;
}

export type SessionState =
    | "IDLE"
    | "CLASSIFYING"
    | "SLOT_FILLING"
    | "CONFIRMING"
    | "EXECUTING"
    | "ESCALATING";

export interface CallSession {
    callSid: string;
    tenantId: string;
    callerNumber: string;
    dialedNumber: string;

    // Conversation state machine
    state: SessionState;
    currentIntent: string | null;
    filledSlots: Record<string, string>;
    missingSlots: string[];
    awaitingConfirmation: boolean;
    confirmationAction: string | null;

    // History
    turns: CallSessionTurn[];
    turnCount: number;
    languageCode: string;

    // Timestamps
    startedAt: number;
    lastActivityAt: number;
}

const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

class InMemorySessionStore {
    private sessions = new Map<string, CallSession>();
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;

    constructor() {
        // Auto-cleanup stale sessions
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, CLEANUP_INTERVAL_MS);
    }

    get(callSid: string): CallSession | undefined {
        const session = this.sessions.get(callSid);
        if (session) {
            session.lastActivityAt = Date.now();
        }
        return session;
    }

    set(callSid: string, session: CallSession): void {
        session.lastActivityAt = Date.now();
        this.sessions.set(callSid, session);
    }

    getOrCreate(input: {
        callSid: string;
        tenantId: string;
        callerNumber: string;
        dialedNumber: string;
        languageCode?: string;
    }): CallSession {
        const existing = this.get(input.callSid);
        if (existing) return existing;

        const session: CallSession = {
            callSid: input.callSid,
            tenantId: input.tenantId,
            callerNumber: input.callerNumber,
            dialedNumber: input.dialedNumber,

            state: "IDLE",
            currentIntent: null,
            filledSlots: {},
            missingSlots: [],
            awaitingConfirmation: false,
            confirmationAction: null,

            turns: [],
            turnCount: 0,
            languageCode: input.languageCode || "en-IN",

            startedAt: Date.now(),
            lastActivityAt: Date.now(),
        };

        this.sessions.set(input.callSid, session);
        return session;
    }

    addTurn(callSid: string, role: "caller" | "system", text: string): void {
        const session = this.sessions.get(callSid);
        if (!session) return;
        session.turns.push({ role, text, timestamp: Date.now() });
        session.turnCount += 1;
        session.lastActivityAt = Date.now();
    }

    resetIntent(callSid: string): void {
        const session = this.sessions.get(callSid);
        if (!session) return;
        session.state = "IDLE";
        session.currentIntent = null;
        session.filledSlots = {};
        session.missingSlots = [];
        session.awaitingConfirmation = false;
        session.confirmationAction = null;
    }

    delete(callSid: string): void {
        this.sessions.delete(callSid);
    }

    cleanup(maxAgeMs = DEFAULT_SESSION_TTL_MS): number {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, session] of this.sessions) {
            if (now - session.lastActivityAt > maxAgeMs) {
                this.sessions.delete(key);
                cleaned++;
            }
        }
        return cleaned;
    }

    /** For debugging / monitoring */
    getActiveCount(): number {
        return this.sessions.size;
    }

    destroy(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        this.sessions.clear();
    }
}

// Singleton — survives across API route invocations in the same process
const globalForSession = globalThis as unknown as {
    __sessionStore?: InMemorySessionStore;
};

export const sessionStore =
    globalForSession.__sessionStore ?? new InMemorySessionStore();

if (process.env.NODE_ENV !== "production") {
    globalForSession.__sessionStore = sessionStore;
}
