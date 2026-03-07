import { ExternalFreeProvider } from "./externalFreeProvider";
import { GeminiProvider } from "./geminiProvider";
import { SelfHostedProvider } from "./selfHostedProvider";
import type { AIProvider, AiProviderMode } from "./types";

export function getAIProvider(mode?: AiProviderMode): AIProvider {
  const resolvedMode = mode || (process.env.AI_PROVIDER_MODE as AiProviderMode) || "external_free";

  if (resolvedMode === "self_hosted") {
    return new SelfHostedProvider();
  }

  // Use Gemini if API key is available (preferred for demo)
  if (process.env.GEMINI_API_KEY) {
    return new GeminiProvider();
  }

  // Fallback to OpenRouter
  return new ExternalFreeProvider();
}
