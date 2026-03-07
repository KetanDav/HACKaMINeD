import { NextResponse } from "next/server";
import { runRuntimeTurn } from "@/lib/runtime/orchestrator";
import type { RuntimeBusinessContext } from "@/lib/mcp/router";

export const runtime = "nodejs";

type RuntimeRequest = {
  utterance: string;
  languageCode?: string;
  context?: RuntimeBusinessContext;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as RuntimeRequest;

    if (!payload?.utterance?.trim()) {
      return NextResponse.json({ error: "utterance is required" }, { status: 400 });
    }

    const result = await runRuntimeTurn({
      utterance: payload.utterance,
      languageCode: payload.languageCode,
      context: payload.context || ({} as RuntimeBusinessContext),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("runtime turn failed", error);
    return NextResponse.json({ error: "Failed to process runtime turn." }, { status: 500 });
  }
}
