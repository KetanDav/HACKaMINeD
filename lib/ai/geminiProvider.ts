import type { AIProvider, IntentResult } from "./types";

type GeminiResponse = {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
    }>;
};

export class GeminiProvider implements AIProvider {
    private readonly apiKey = process.env.GEMINI_API_KEY;
    private readonly model = process.env.EXTERNAL_FREE_MODEL || "gemini-2.0-flash";

    private async chat(prompt: string, systemInstruction?: string): Promise<string> {
        if (!this.apiKey) {
            throw new Error("GEMINI_API_KEY is not configured.");
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

        const body: Record<string, unknown> = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 256,
            },
        };

        if (systemInstruction) {
            body.systemInstruction = { parts: [{ text: systemInstruction }] };
        }

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Gemini request failed: ${response.status} - ${errorBody}`);
        }

        const data = (await response.json()) as GeminiResponse;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        return text;
    }

    private extractJson(raw: string): string {
        // Strip markdown code fences if present
        const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (fenceMatch?.[1]) return fenceMatch[1].trim();
        // Try to find JSON object directly
        const objMatch = raw.match(/\{[\s\S]*\}/);
        if (objMatch?.[0]) return objMatch[0];
        return raw;
    }

    async classifyIntent(input: {
        utterance: string;
        allowedIntents: string[];
    }): Promise<IntentResult> {
        const system = `You are an intent classifier for a voice assistant. Classify the user utterance into one of the allowed intents. Return ONLY a JSON object with no extra text.`;

        const prompt = `Allowed intents: ${input.allowedIntents.join(", ")}

User utterance: "${input.utterance}"

Return JSON: {"intent": "one_of_allowed_intents", "confidence": 0.0_to_1.0, "slots": {"key": "value"}}

Extract any slots you can find (like date, time, name, order_id, query) from the utterance.`;

        const raw = await this.chat(prompt, system);

        try {
            const cleaned = this.extractJson(raw);
            const parsed = JSON.parse(cleaned) as IntentResult;
            return {
                intent: parsed.intent,
                confidence: Number(parsed.confidence) || 0,
                slots: parsed.slots || {},
            };
        } catch {
            return {
                intent: input.allowedIntents[0] || "unknown",
                confidence: 0,
                slots: {},
            };
        }
    }

    async extractSlots(input: {
        utterance: string;
        requiredSlots: string[];
    }): Promise<Record<string, string>> {
        const system = `You are a slot extractor for a voice assistant. Extract values from the user utterance. Return ONLY a JSON object with no extra text.`;

        const prompt = `Required slots: ${input.requiredSlots.join(", ")}

User utterance: "${input.utterance}"

Return JSON object with only the slots you can extract. Example: {"name": "Rahul", "date": "friday"}
If a slot cannot be extracted, omit it from the response.`;

        const raw = await this.chat(prompt, system);

        try {
            const cleaned = this.extractJson(raw);
            return JSON.parse(cleaned) as Record<string, string>;
        } catch {
            return {};
        }
    }

    async generateText(input: { prompt: string; system?: string }): Promise<string> {
        return this.chat(input.prompt, input.system);
    }
}
