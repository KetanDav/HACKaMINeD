import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import { ensureKbDirs, getKbUploadsDir, saveKbIndex } from "./storage";
import type { KBChunk, KBIndex } from "./types";

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

async function extractText(file: File) {
  const ext = path.extname(file.name).toLowerCase();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (ext === ".pdf") {
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    return cleanText(parsed.text || "");
  }

  if (ext === ".txt" || ext === ".csv") {
    return cleanText(buffer.toString("utf-8"));
  }

  return "";
}

/**
 * Extracts text from uploaded files and stores them directly into the PostgreSQL
 * database as `Policy` records. This bypasses the need for local disk storage,
 * which is incompatible with Vercel's serverless environment.
 */
export async function ingestKnowledgeBase(tenantId: string, files: File[]) {
  const { prisma } = await import("@/lib/prisma");
  let chunksCreated = 0;

  for (const file of files) {
    const extracted = await extractText(file);
    if (!extracted) continue;

    // We store the full extracted text as a single "Policy" to be searched later
    await prisma.policy.create({
      data: {
        tenantId,
        title: `Uploaded Document: ${file.name}`,
        content: extracted,
      },
    });

    chunksCreated++;
  }

  return {
    filesProcessed: files.length,
    chunksCreated,
  };
}
