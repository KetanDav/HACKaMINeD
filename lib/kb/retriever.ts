import { prisma } from "@/lib/prisma";

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function scoreChunk(queryTokens: string[], chunkText: string) {
  const chunkTokens = new Set(tokenize(chunkText));
  let score = 0;
  for (const token of queryTokens) {
    if (chunkTokens.has(token)) score += 1;
  }
  return score;
}

/**
 * Searches the PostgreSQL `Policy` and `Faq` tables for the given tenant
 * instead of relying on local disk storage.
 */
export async function searchKnowledgeBase(input: {
  knowledgeBaseId: string; // This is now equal to tenantId
  query: string;
  topK?: number;
}) {
  const topK = input.topK ?? 3;
  const tenantId = input.knowledgeBaseId;

  const [policies, faqs] = await Promise.all([
    prisma.policy.findMany({ where: { tenantId } }),
    prisma.faq.findMany({ where: { tenantId } }),
  ]);

  if (policies.length === 0 && faqs.length === 0) {
    return {
      found: false,
      answer: "Knowledge base not found for this business.",
      matches: [],
    };
  }

  // Combine policies and FAQs into generic chunks for scoring
  const chunks = [
    ...policies.map((p) => ({
      id: p.id,
      text: `${p.title}: ${p.content}`,
      source: "Policy",
    })),
    ...faqs.map((f) => ({
      id: f.id,
      text: `Q: ${f.question} A: ${f.answer}`,
      source: "FAQ",
    })),
  ];

  const queryTokens = tokenize(input.query);
  const ranked = chunks
    .map((chunk) => ({
      chunk,
      score: scoreChunk(queryTokens, chunk.text),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  if (ranked.length === 0) {
    return {
      found: false,
      answer: "I could not find this information in the uploaded knowledge base.",
      matches: [],
    };
  }

  const answer = ranked.map((item) => item.chunk.text).join(" ");

  return {
    found: true,
    answer,
    matches: ranked.map((item) => ({
      score: item.score,
      sourceFile: item.chunk.source,
      chunkId: item.chunk.id,
    })),
  };
}
