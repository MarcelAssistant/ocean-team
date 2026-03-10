import OpenAI from "openai";
import { prisma } from "../db.js";

const HYPER_REALISTIC_PROMPT = `You are a character designer for hyper-realistic video. Analyze this reference image (drawing, photo, or concept art) and produce a concise outline for a video character.

Output a JSON object with these keys:
- appearance: Detailed physical description for photorealistic rendering (face shape, eyes, hair, skin, build, distinctive features). Be specific so the same look can be reproduced.
- attitude: Personality, demeanor, expression style in 1-2 sentences.
- role: Suggested story role (e.g. hero, mentor, antagonist) in one phrase.

Focus on what a hyper-realistic video generator needs: precise, visual, reproducible details.`;

const MANGA_REALISTIC_PROMPT = `You are a character designer for manga-realistic (anime-style but grounded) video. Analyze this reference image (drawing, photo, or concept art) and produce a concise outline for a video character.

Output a JSON object with these keys:
- appearance: Description optimized for manga/anime-style rendering (face, eyes, hair style and color, proportions, distinctive anime-style features). Use terms that work for stylized 2D/2.5D animation.
- attitude: Personality, demeanor, expression style in 1-2 sentences.
- role: Suggested story role (e.g. hero, mentor, antagonist) in one phrase.

Focus on what a manga-style video generator needs: stylized but consistent, anime-appropriate details.`;

export async function describeCharacterFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  style: "hyper_realistic" | "manga_realistic"
): Promise<{ appearance: string; attitude: string; role: string }> {
  const openaiKey = (await prisma.setting.findUnique({ where: { key: "openai_api_key" } }))?.value;
  if (!openaiKey?.trim()) throw new Error("OpenAI API key not configured. Add it in Settings.");

  const client = new OpenAI({ apiKey: openaiKey });
  const prompt = style === "manga_realistic" ? MANGA_REALISTIC_PROMPT : HYPER_REALISTIC_PROMPT;

  const base64 = imageBuffer.toString("base64");
  const mediaType = mimeType || "image/png";

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: `data:${mediaType};base64,${base64}` },
          },
        ],
      },
    ],
  });

  const text = res.choices[0]?.message?.content?.trim() || "{}";
  try {
    const parsed = JSON.parse(text.replace(/```json\s*|\s*```/g, "").trim());
    return {
      appearance: String(parsed.appearance || "").trim() || "—",
      attitude: String(parsed.attitude || "").trim() || "—",
      role: String(parsed.role || "").trim() || "—",
    };
  } catch {
    return { appearance: text.slice(0, 500), attitude: "—", role: "—" };
  }
}
