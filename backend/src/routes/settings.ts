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

    const apiKeySetting = await prisma.setting.findUnique({ where: { key: "openai_api_key" } });
    if (!apiKeySetting?.value) return { success: false, error: "OpenAI API key not configured" };
    try {
      const client = new OpenAI({ apiKey: apiKeySetting.value });
      await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 10,
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  app.post("/api/settings/test-venice", async (req) => {
    const body = (req.body as { apiKey?: string; model?: string }) || {};
    const apiKey = body.apiKey?.trim() || (await prisma.setting.findUnique({ where: { key: "venice_api_key" } }))?.value?.trim();
    const model = body.model?.trim() || (await prisma.setting.findUnique({ where: { key: "venice_default_video_model" } }))?.value?.trim() || "wan-2.5-preview-image-to-video";
    if (!apiKey) return { success: false, error: "Venice API key not configured" };
    try {
      const res = await fetch("https://api.venice.ai/api/v1/video/quote", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, duration: "5s", resolution: "720p" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((err as { error?: string }).error || `Venice API ${res.status}`);
      }
      const data = (await res.json()) as { quote?: number };
      return { success: true, quote: data.quote };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  app.post("/api/settings/generate-test-video", async (req) => {
    const body = (req.body as { apiKey?: string; model?: string }) || {};
    const apiKey = body.apiKey?.trim() || (await prisma.setting.findUnique({ where: { key: "venice_api_key" } }))?.value?.trim();
    const model = body.model?.trim() || (await prisma.setting.findUnique({ where: { key: "venice_default_video_model" } }))?.value?.trim() || "wan-2.5-preview-image-to-video";
    if (!apiKey) return { success: false, error: "Venice API key not configured" };
    try {
      const { generateVideoAndWait } = await import("../services/venice.js");
      const { getDataDir } = await import("../services/paths.js");
      const pathMod = await import("path");
      const fs = await import("fs");

      // Venice image-to-video requires image_url. Use data URL (Venice fetches URLs; data URL is more reliable)
      // Minimal 64x64 gray PNG — Venice docs example uses data:image/png;base64,...
      const placeholderImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAMElEQVR42u3OMQEAAAjDMMC/52ECvlCI00nZ3r0dAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHwG6xoAAZ/1HwsAAAAASUVORK5CYII=";
      const { queue_id, videoBuffer } = await generateVideoAndWait(apiKey, {
        model,
        prompt: "Smooth gradient background slowly shifting colors, cinematic motion, high quality",
        duration: "5s",
        resolution: "720p",
        image_url: placeholderImage,
      });

      const workspaceDir = pathMod.join(getDataDir(), "workspace");
      if (!fs.existsSync(workspaceDir)) fs.mkdirSync(workspaceDir, { recursive: true });
      const fileName = `test-${queue_id}.mp4`;
      fs.writeFileSync(pathMod.join(workspaceDir, fileName), videoBuffer);

      return { success: true, fileName, videoUrl: `/api/files/${fileName}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });
}
