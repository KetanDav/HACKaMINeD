import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import type { KBIndex } from "./types";

function resolveDataRoot() {
  if (process.env.KB_DATA_DIR?.trim()) {
    return process.env.KB_DATA_DIR;
  }

  // Vercel/AWS Lambda file system is read-only except /tmp.
  if (process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "kb");
  }

  return path.join(process.cwd(), "data", "kb");
}

const DATA_ROOT = resolveDataRoot();

export function getKbRoot(knowledgeBaseId: string) {
  return path.join(DATA_ROOT, knowledgeBaseId);
}

export function getKbUploadsDir(knowledgeBaseId: string) {
  return path.join(getKbRoot(knowledgeBaseId), "uploads");
}

export function getKbIndexPath(knowledgeBaseId: string) {
  return path.join(getKbRoot(knowledgeBaseId), "index.json");
}

export async function ensureKbDirs(knowledgeBaseId: string) {
  await mkdir(getKbUploadsDir(knowledgeBaseId), { recursive: true });
}

export async function saveKbIndex(index: KBIndex) {
  await ensureKbDirs(index.knowledgeBaseId);
  await writeFile(getKbIndexPath(index.knowledgeBaseId), JSON.stringify(index, null, 2), "utf-8");
}

export async function loadKbIndex(knowledgeBaseId: string): Promise<KBIndex | null> {
  const indexPath = getKbIndexPath(knowledgeBaseId);
  if (!existsSync(indexPath)) return null;

  const raw = await readFile(indexPath, "utf-8");
  return JSON.parse(raw) as KBIndex;
}
