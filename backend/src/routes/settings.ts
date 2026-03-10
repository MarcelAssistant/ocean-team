import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import OpenAI from "openai";

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/api/settings", async () => {
    const settings = await prisma.setting.findMany();
    const map: Record<string, string> = {};
    const SECRET_KEYS = ["openai_api_key", "telegram_bot_token", "venice_api_key", "elevenlabs_api_key"];
    for (const s of settings) {
      map[s.key] = SECRET_KEYS.includes(s.key) && s.value
        ? s.value.slice(0, 8) + "..." + s.value.slice(-4)
        : s.value;
    }
    return map;
  });

  app.get("/api/settings/raw", async () => {
    const settings = await prisma.setting.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;
    return map;
  });

  app.put("/api/settings", async (req) => {
    const body = req.body as Record<string, string>;
    const results: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      const setting = await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
      results[key] = setting.value;
    }
    return results;
  });

  app.post("/api/settings/test", async (req) => {
    const body = (req.body as { model?: string }) || {};
    const model = body.model || (await prisma.setting.findUnique({ where: { key: "default_model" } }))?.value || "gpt-4o-mini";
    const useVenice = model.startsWith("venice-");

    const apiKeySetting = await prisma.setting.findUnique({
      where: { key: useVenice ? "venice_api_key" : "openai_api_key" },
    });
    if (!apiKeySetting?.value) {
      return { success: false, error: useVenice ? "Venice API key not configured" : "No API key configured" };
    }
    try {
      const client = useVenice
        ? new OpenAI({ apiKey: apiKeySetting.value, baseURL: "https://api.venice.ai/api/v1" })
        : new OpenAI({ apiKey: apiKeySetting.value });
      if (useVenice) {
        const res = await client.chat.completions.create({
          model: model || "venice-uncensored",
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 10,
        });
        return { success: true, models: [model] };
      }
      const models = await client.models.list();
      const modelIds = [];
      for await (const m of models) {
        modelIds.push(m.id);
        if (modelIds.length >= 3) break;
      }
      return { success: true, models: modelIds };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });
}
