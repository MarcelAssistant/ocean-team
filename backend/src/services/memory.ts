import OpenAI from "openai";
import { prisma } from "../db.js";
import { log } from "../logger.js";

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;
const MAX_SEARCH_RESULTS = 8;
const EMBEDDING_MODEL = "text-embedding-3-small";

// ── Chunking ────────────────────────────────────

export function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  if (text.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    // Try to break at a paragraph or sentence boundary
    if (end < text.length) {
      const slice = text.slice(start, end);
      const lastPara = slice.lastIndexOf("\n\n");
      const lastNewline = slice.lastIndexOf("\n");
      const lastPeriod = slice.lastIndexOf(". ");

      if (lastPara > chunkSize * 0.5) end = start + lastPara;
      else if (lastNewline > chunkSize * 0.5) end = start + lastNewline;
      else if (lastPeriod > chunkSize * 0.5) end = start + lastPeriod + 1;
    }

    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
    if (start < 0) start = 0;
    if (end >= text.length) break;
  }

  return chunks.filter((c) => c.length > 20);
}

// ── Embeddings ──────────────────────────────────

async function getClient(): Promise<OpenAI | null> {
  const key = await prisma.setting.findUnique({ where: { key: "openai_api_key" } });
  if (!key?.value) return null;
  return new OpenAI({ apiKey: key.value });
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const client = await getClient();
  if (!client) return [];

  try {
    const resp = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000),
    });
    return resp.data[0].embedding;
  } catch (e: any) {
    await log("error", "memory", `Embedding failed: ${e.message}`);
    return [];
  }
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const client = await getClient();
  if (!client || texts.length === 0) return texts.map(() => []);

  try {
    const resp = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts.map((t) => t.slice(0, 8000)),
    });
    return resp.data.map((d) => d.embedding);
  } catch (e: any) {
    await log("error", "memory", `Batch embedding failed: ${e.message}`);
    return texts.map(() => []);
  }
}

// ── Cosine similarity ───────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Store with embedding ────────────────────────

export async function storeMemory(
  agentId: string,
  content: string,
  type: string = "note",
  opts: { ticketId?: string; sourceId?: string } = {}
): Promise<void> {
  const chunks = chunkText(content);
  const embeddings = await generateEmbeddings(chunks);

  for (let i = 0; i < chunks.length; i++) {
    await prisma.memory.create({
      data: {
        agentId,
        type,
        content: chunks[i],
        ticketId: opts.ticketId || null,
        sourceId: opts.sourceId || null,
        chunkIndex: i,
        embedding: JSON.stringify(embeddings[i] || []),
        relevance: 1.0,
      },
    });
  }

  await log("info", "memory", `Stored ${chunks.length} chunk(s) for agent ${agentId}`, { type, chunks: chunks.length });
}

// ── Semantic search ─────────────────────────────

export async function searchMemory(
  agentId: string,
  query: string,
  limit: number = MAX_SEARCH_RESULTS
): Promise<{ content: string; type: string; score: number; createdAt: Date }[]> {
  const queryEmbedding = await generateEmbedding(query);
  if (queryEmbedding.length === 0) {
    // Fallback to recent memories if no embedding available
    const recent = await prisma.memory.findMany({
      where: { agentId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return recent.map((m) => ({ content: m.content, type: m.type, score: 0.5, createdAt: m.createdAt }));
  }

  const memories = await prisma.memory.findMany({
    where: { agentId },
    select: { id: true, content: true, type: true, embedding: true, createdAt: true, relevance: true },
  });

  const scored = memories
    .map((m) => {
      let emb: number[] = [];
      try { emb = JSON.parse(m.embedding || "[]"); } catch {}
      const similarity = cosineSimilarity(queryEmbedding, emb);
      // Boost relevance score and recency
      const ageHours = (Date.now() - m.createdAt.getTime()) / 3600000;
      const recencyBoost = Math.max(0, 1 - ageHours / (24 * 30)); // decay over 30 days
      const finalScore = similarity * 0.7 + recencyBoost * 0.15 + m.relevance * 0.15;
      return { content: m.content, type: m.type, score: finalScore, createdAt: m.createdAt };
    })
    .filter((m) => m.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

// ── Memory pruning ──────────────────────────────

export async function pruneMemories(agentId?: string): Promise<number> {
  const where: any = {};
  if (agentId) where.agentId = agentId;

  const allMemories = await prisma.memory.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true, agentId: true, createdAt: true, relevance: true, type: true },
  });

  // Group by agent
  const byAgent = new Map<string, typeof allMemories>();
  for (const m of allMemories) {
    const list = byAgent.get(m.agentId) || [];
    list.push(m);
    byAgent.set(m.agentId, list);
  }

  let pruned = 0;
  const MAX_PER_AGENT = 500;
  const MIN_AGE_DAYS = 30;

  for (const [aid, memories] of byAgent) {
    if (memories.length <= MAX_PER_AGENT) continue;

    // Keep the most recent MAX_PER_AGENT, prune old low-relevance ones
    const candidates = memories.slice(MAX_PER_AGENT);
    for (const m of candidates) {
      const ageDays = (Date.now() - m.createdAt.getTime()) / 86400000;
      if (ageDays > MIN_AGE_DAYS && m.relevance < 0.5) {
        await prisma.memory.delete({ where: { id: m.id } });
        pruned++;
      }
    }
  }

  if (pruned > 0) {
    await log("info", "memory", `Pruned ${pruned} old low-relevance memories`);
  }
  return pruned;
}
