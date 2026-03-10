import { prisma } from "../db.js";
import { log } from "../logger.js";

const TOKEN_ESTIMATE_RATIO = 4; // ~4 chars per token

function estimateTokens(text: string): number {
  return Math.ceil(text.length / TOKEN_ESTIMATE_RATIO);
}

function compressPrompt(prompt: string): string {
  let result = prompt;

  // Remove redundant whitespace
  result = result.replace(/\n{3,}/g, "\n\n");
  result = result.replace(/[ \t]+/g, " ");

  // Shorten common verbose patterns
  result = result.replace(/Please make sure to /g, "");
  result = result.replace(/You should always /g, "Always ");
  result = result.replace(/It is important that you /g, "");
  result = result.replace(/Make sure that /g, "");
  result = result.replace(/You need to /g, "");
  result = result.replace(/In order to /g, "To ");
  result = result.replace(/The purpose of this is to /g, "This ");
  result = result.replace(/When you are asked to /g, "When asked to ");

  return result.trim();
}

function compressMemoryContext(memories: string[], maxTokens: number): string {
  let total = 0;
  const kept: string[] = [];

  for (const m of memories) {
    const tokens = estimateTokens(m);
    if (total + tokens > maxTokens) break;
    kept.push(m);
    total += tokens;
  }

  return kept.join("\n\n");
}

function trimConversationHistory(
  messages: { role: string; content: string }[],
  maxTokens: number
): { role: string; content: string }[] {
  // Always keep the last message (user's current input)
  if (messages.length === 0) return messages;

  let total = 0;
  const result: { role: string; content: string }[] = [];

  // Walk backwards, keeping messages until we hit the budget
  for (let i = messages.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(messages[i].content);
    if (total + tokens > maxTokens && result.length >= 2) {
      // Add a summary marker for skipped messages
      const skipped = i + 1;
      if (skipped > 0) {
        result.unshift({ role: "system", content: `[${skipped} earlier messages omitted for efficiency]` });
      }
      break;
    }
    result.unshift(messages[i]);
    total += tokens;
  }

  return result;
}

export interface OptimizedPrompt {
  systemPrompt: string;
  messages: { role: string; content: string }[];
  memoryContext: string;
  stats: {
    originalTokens: number;
    optimizedTokens: number;
    saved: number;
    savingsPercent: number;
  };
}

export function optimizeForChat(
  systemPrompt: string,
  conversationMessages: { role: string; content: string }[],
  memoryContext: string,
  opts: { maxSystemTokens?: number; maxHistoryTokens?: number; maxMemoryTokens?: number } = {}
): OptimizedPrompt {
  const maxSystemTokens = opts.maxSystemTokens || 800;
  const maxHistoryTokens = opts.maxHistoryTokens || 3000;
  const maxMemoryTokens = opts.maxMemoryTokens || 600;

  const originalTokens =
    estimateTokens(systemPrompt) +
    conversationMessages.reduce((t, m) => t + estimateTokens(m.content), 0) +
    estimateTokens(memoryContext);

  // 1. Compress system prompt
  let optimizedSystem = compressPrompt(systemPrompt);
  if (estimateTokens(optimizedSystem) > maxSystemTokens) {
    optimizedSystem = optimizedSystem.slice(0, maxSystemTokens * TOKEN_ESTIMATE_RATIO);
  }

  // 2. Trim conversation history
  const optimizedMessages = trimConversationHistory(conversationMessages, maxHistoryTokens);

  // 3. Compress memory context
  const memoryLines = memoryContext.split("\n\n").filter(Boolean);
  const optimizedMemory = compressMemoryContext(memoryLines, maxMemoryTokens);

  const optimizedTokens =
    estimateTokens(optimizedSystem) +
    optimizedMessages.reduce((t, m) => t + estimateTokens(m.content), 0) +
    estimateTokens(optimizedMemory);

  const saved = originalTokens - optimizedTokens;

  return {
    systemPrompt: optimizedSystem,
    messages: optimizedMessages,
    memoryContext: optimizedMemory,
    stats: {
      originalTokens,
      optimizedTokens,
      saved,
      savingsPercent: originalTokens > 0 ? Math.round((saved / originalTokens) * 100) : 0,
    },
  };
}

// Scheduled task: analyze and report on token usage
export async function analyzeTokenUsage(): Promise<string> {
  const agents = await prisma.agent.findMany({ where: { enabled: true }, select: { id: true, name: true, systemPrompt: true } });
  const stats: string[] = [];
  let totalOriginal = 0;
  let totalOptimized = 0;

  for (const agent of agents) {
    const original = estimateTokens(agent.systemPrompt);
    const compressed = estimateTokens(compressPrompt(agent.systemPrompt));
    totalOriginal += original;
    totalOptimized += compressed;

    if (original - compressed > 20) {
      stats.push(`${agent.name}: ${original}→${compressed} tokens (save ${original - compressed})`);
    }
  }

  const memoryCount = await prisma.memory.count();
  const msgCount = await prisma.message.count();

  const report = [
    `Token usage analysis:`,
    `  Agents: ${agents.length}, prompts: ~${totalOriginal} tokens (optimized: ~${totalOptimized})`,
    `  Memories: ${memoryCount}, Messages: ${msgCount}`,
    stats.length > 0 ? `  Optimization opportunities:\n    ${stats.join("\n    ")}` : `  All prompts are efficient.`,
  ].join("\n");

  await log("info", "system-agent", report);
  return report;
}
