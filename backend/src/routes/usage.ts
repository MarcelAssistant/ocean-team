import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15 / 1e6, output: 0.6 / 1e6 },
  "gpt-5.1": { input: 1.25 / 1e6, output: 10 / 1e6 },
  "gpt-4-turbo": { input: 10 / 1e6, output: 30 / 1e6 },
  "text-embedding-3-small": { input: 0.02 / 1e6, output: 0 },
  "llama-3.3-70b": { input: 0.70 / 1e6, output: 2.80 / 1e6 },
  "venice-uncensored": { input: 0.20 / 1e6, output: 0.90 / 1e6 },
  "qwen3-vl-235b-a22b": { input: 0.25 / 1e6, output: 1.50 / 1e6 },
};

export async function usageRoutes(app: FastifyInstance) {
  app.get("/api/usage", async (req) => {
    const query = req.query as { period?: string };
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    if (query.period === "week") {
      start.setTime(now.getTime() - 7 * 86400000);
    }

    const records = await prisma.apiUsage.findMany({
      where: { createdAt: { gte: start } },
      orderBy: { createdAt: "desc" },
    });

    const totalCost = records.reduce((sum, r) => sum + r.estimatedCost, 0);
    const totalTokens = records.reduce((sum, r) => sum + r.totalTokens, 0);

    const limitSetting = await prisma.setting.findUnique({ where: { key: "monthly_cost_limit" } });
    const limit = parseFloat(limitSetting?.value || "10");

    return {
      period: query.period || "month",
      totalCost: Math.round(totalCost * 10000) / 10000,
      totalTokens,
      calls: records.length,
      limit,
      percentUsed: limit > 0 ? Math.round((totalCost / limit) * 100) : 0,
      byModel: groupByModel(records),
    };
  });

  app.put("/api/usage/limit", async (req) => {
    const { limit } = req.body as { limit: number };
    await prisma.setting.upsert({
      where: { key: "monthly_cost_limit" },
      update: { value: String(limit) },
      create: { key: "monthly_cost_limit", value: String(limit) },
    });
    return { success: true, limit };
  });
}

function groupByModel(records: any[]) {
  const groups: Record<string, { calls: number; tokens: number; cost: number }> = {};
  for (const r of records) {
    if (!groups[r.model]) groups[r.model] = { calls: 0, tokens: 0, cost: 0 };
    groups[r.model].calls++;
    groups[r.model].tokens += r.totalTokens;
    groups[r.model].cost += r.estimatedCost;
  }
  return groups;
}

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const rates = MODEL_COSTS[model] || MODEL_COSTS["gpt-4o-mini"];
  return promptTokens * rates.input + completionTokens * rates.output;
}

export async function trackUsage(model: string, promptTokens: number, completionTokens: number) {
  const cost = estimateCost(model, promptTokens, completionTokens);
  await prisma.apiUsage.create({
    data: {
      model,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCost: cost,
    },
  });

  // Check if over limit
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthUsage = await prisma.apiUsage.aggregate({
    where: { createdAt: { gte: monthStart } },
    _sum: { estimatedCost: true },
  });
  const totalCost = monthUsage._sum.estimatedCost || 0;
  const limitSetting = await prisma.setting.findUnique({ where: { key: "monthly_cost_limit" } });
  const limit = parseFloat(limitSetting?.value || "10");

  if (totalCost > limit * 0.8 && totalCost - cost <= limit * 0.8) {
    const { createNotification } = await import("./notifications.js");
    await createNotification("warning", "API cost warning", `You've used ${Math.round((totalCost / limit) * 100)}% of your $${limit} monthly limit.`);
  }
}
