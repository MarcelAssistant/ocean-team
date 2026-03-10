import { FastifyInstance } from "fastify";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { prisma } from "../db.js";
import { getDataDir } from "../services/paths.js";
import { describeCharacterFromImage } from "../services/character-vision.js";

function getWorkspaceDir(): string {
  const dir = path.join(getDataDir(), "workspace");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function characterRoutes(app: FastifyInstance) {
  app.post("/api/characters/describe-from-image", async (req, reply) => {
    const parts = req.parts();
    let imageBuffer: Buffer | null = null;
    let mimeType = "image/png";
    let style = "hyper_realistic";
    for await (const part of parts) {
      if (part.type === "file" && part.fieldname === "image") {
        imageBuffer = await part.toBuffer();
        mimeType = part.mimetype || "image/png";
      } else if (part.type === "field" && part.fieldname === "style") {
        const v = (await part.value) as string;
        if (v === "manga_realistic") style = "manga_realistic";
      }
    }
    if (!imageBuffer || imageBuffer.length === 0) {
      return reply.status(400).send({ error: "Image file is required" });
    }
    try {
      const result = await describeCharacterFromImage(imageBuffer, mimeType, style as "hyper_realistic" | "manga_realistic");
      return result;
    } catch (e: any) {
      return reply.status(500).send({ error: e.message || "Failed to analyze image" });
    }
  });

  app.get("/api/characters", async (req) => {
    const style = (req.query as { style?: string })?.style;
    const where = style && (style === "hyper_realistic" || style === "manga_realistic") ? { style } : {};
    const characters = await prisma.videoCharacter.findMany({
      where,
      include: { outfits: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    });
    return { characters };
  });

  app.post("/api/characters", async (req, reply) => {
    const contentType = req.headers["content-type"] || "";
    let name = "";
    let style = "hyper_realistic";
    let appearance = "";
    let attitude = "";
    let role = "";
    let notes = "";
    let referenceImagePath = "";

    if (contentType.includes("multipart/form-data")) {
      const parts = req.parts();
      for await (const part of parts) {
        if (part.type === "file" && part.fieldname === "image") {
          const buffer = await part.toBuffer();
          if (buffer.length > 0) {
            const ext = path.extname((part as any).filename || "") || ".png";
            const id = crypto.randomBytes(8).toString("hex");
            const storedName = `char-ref-${id}${ext}`;
            fs.writeFileSync(path.join(getWorkspaceDir(), storedName), buffer);
            referenceImagePath = storedName;
          }
        } else if (part.type === "field") {
          const v = String((await part.value) || "");
          if (part.fieldname === "name") name = v.trim();
          else if (part.fieldname === "style") style = v === "manga_realistic" ? "manga_realistic" : "hyper_realistic";
          else if (part.fieldname === "appearance") appearance = v.trim();
          else if (part.fieldname === "attitude") attitude = v.trim();
          else if (part.fieldname === "role") role = v.trim();
          else if (part.fieldname === "notes") notes = v.trim();
        }
      }
    } else {
      const body = req.body as { name?: string; style?: string; appearance?: string; attitude?: string; role?: string; notes?: string };
      name = String(body.name || "").trim();
      style = body.style === "manga_realistic" ? "manga_realistic" : "hyper_realistic";
      appearance = String(body.appearance || "").trim();
      attitude = String(body.attitude || "").trim();
      role = String(body.role || "").trim();
      notes = String(body.notes || "").trim();
    }

    if (!name) return reply.status(400).send({ error: "name is required" });
    const character = await prisma.videoCharacter.create({
      data: { name, style, appearance, attitude, role, notes, referenceImagePath },
    });
    return { character };
  });

  app.get("/api/characters/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const character = await prisma.videoCharacter.findUnique({
      where: { id },
      include: { outfits: { orderBy: { name: "asc" } } },
    });
    if (!character) return reply.status(404).send({ error: "Character not found" });
    return { character };
  });

  app.put("/api/characters/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const character = await prisma.videoCharacter.findUnique({ where: { id } });
    if (!character) return reply.status(404).send({ error: "Character not found" });

    const contentType = req.headers["content-type"] || "";
    const updates: Record<string, string> = {};

    if (contentType.includes("multipart/form-data")) {
      const parts = req.parts();
      for await (const part of parts) {
        if (part.type === "file" && part.fieldname === "image") {
          const buffer = await part.toBuffer();
          if (buffer.length > 0) {
            const ext = path.extname((part as any).filename || "") || ".png";
            const refId = crypto.randomBytes(8).toString("hex");
            const storedName = `char-ref-${refId}${ext}`;
            fs.writeFileSync(path.join(getWorkspaceDir(), storedName), buffer);
            updates.referenceImagePath = storedName;
          }
        } else if (part.type === "field") {
          const v = String((await part.value) || "");
          if (part.fieldname === "name") updates.name = v.trim();
          else if (part.fieldname === "style") updates.style = v === "manga_realistic" ? "manga_realistic" : "hyper_realistic";
          else if (part.fieldname === "appearance") updates.appearance = v.trim();
          else if (part.fieldname === "attitude") updates.attitude = v.trim();
          else if (part.fieldname === "role") updates.role = v.trim();
          else if (part.fieldname === "notes") updates.notes = v.trim();
        }
      }
    } else {
      const body = req.body as { name?: string; style?: string; appearance?: string; attitude?: string; role?: string; notes?: string };
      if (body.name != null) updates.name = String(body.name).trim();
      if (body.style != null) updates.style = body.style === "manga_realistic" ? "manga_realistic" : "hyper_realistic";
      if (body.appearance != null) updates.appearance = String(body.appearance).trim();
      if (body.attitude != null) updates.attitude = String(body.attitude).trim();
      if (body.role != null) updates.role = String(body.role).trim();
      if (body.notes != null) updates.notes = String(body.notes).trim();
    }

    const updated = await prisma.videoCharacter.update({
      where: { id },
      data: updates,
      include: { outfits: true },
    });
    return { character: updated };
  });

  app.post("/api/characters/:id/outfits", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { name: string; description?: string };
    const character = await prisma.videoCharacter.findUnique({ where: { id } });
    if (!character) return reply.status(404).send({ error: "Character not found" });
    const name = String(body.name || "").trim();
    if (!name) return reply.status(400).send({ error: "outfit name is required" });
    const outfit = await prisma.videoOutfit.create({
      data: { characterId: id, name, description: String(body.description || "").trim() },
    });
    return { outfit };
  });

  app.put("/api/characters/:characterId/outfits/:outfitId", async (req, reply) => {
    const { characterId, outfitId } = req.params as { characterId: string; outfitId: string };
    const body = req.body as { name?: string; description?: string };
    const outfit = await prisma.videoOutfit.findFirst({
      where: { id: outfitId, characterId },
    });
    if (!outfit) return reply.status(404).send({ error: "Outfit not found" });
    const updated = await prisma.videoOutfit.update({
      where: { id: outfitId },
      data: {
        ...(body.name != null && { name: String(body.name).trim() }),
        ...(body.description != null && { description: String(body.description).trim() }),
      },
    });
    return { outfit: updated };
  });
}
