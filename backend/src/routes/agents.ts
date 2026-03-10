import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { storeMemory, searchMemory } from "../services/memory.js";

export async function agentRoutes(app: FastifyInstance) {
  app.get("/api/agents", async () => {
    return prisma.agent.findMany({
      include: { agentSkills: { include: { skill: true } } },
      orderBy: { createdAt: "desc" },
    });
  });

  app.get("/api/agents/:id", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.agent.findUniqueOrThrow({
      where: { id },
      include: {
        agentSkills: { include: { skill: true } },
        conversations: { orderBy: { updatedAt: "desc" } },
        tickets: { orderBy: { createdAt: "desc" } },
        memories: { orderBy: { createdAt: "desc" } },
      },
    });
  });

  app.post("/api/agents", async (req) => {
    const body = req.body as any;
    return prisma.agent.create({
      data: {
        name: body.name,
        description: body.description || "",
        role: body.role || "",
        mission: body.mission || "",
        systemPrompt: body.systemPrompt || "You are a helpful assistant.",
        model: body.model || "gpt-4o-mini",
        temperature: body.temperature ?? 0.7,
        maxTokens: body.maxTokens ?? 2048,
        enabled: body.enabled ?? true,
        tags: JSON.stringify(body.tags || []),
      },
    });
  });

  app.put("/api/agents/:id", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.role !== undefined) data.role = body.role;
    if (body.mission !== undefined) data.mission = body.mission;
    if (body.systemPrompt !== undefined) data.systemPrompt = body.systemPrompt;
    if (body.model !== undefined) data.model = body.model;
    if (body.temperature !== undefined) data.temperature = body.temperature;
    if (body.maxTokens !== undefined) data.maxTokens = body.maxTokens;
    if (body.enabled !== undefined) data.enabled = body.enabled;
    if (body.tags !== undefined) data.tags = JSON.stringify(body.tags);
    return prisma.agent.update({ where: { id }, data });
  });

  app.delete("/api/agents/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = await prisma.agent.findUnique({ where: { id } });
    if (agent?.isSystem) {
      return reply.status(400).send({ error: "Cannot delete system agents." });
    }
    await prisma.agent.delete({ where: { id } });
    return { success: true };
  });

  // Agent skills
  app.post("/api/agents/:id/skills", async (req) => {
    const { id } = req.params as { id: string };
    const { skillId } = req.body as { skillId: string };
    return prisma.agentSkill.create({
      data: { agentId: id, skillId },
      include: { skill: true },
    });
  });

  app.delete("/api/agents/:id/skills/:skillId", async (req) => {
    const { id, skillId } = req.params as { id: string; skillId: string };
    await prisma.agentSkill.deleteMany({
      where: { agentId: id, skillId },
    });
    return { success: true };
  });

  // Conversations
  app.get("/api/agents/:id/conversations", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.conversation.findMany({
      where: { agentId: id },
      orderBy: { updatedAt: "desc" },
    });
  });

  app.post("/api/agents/:id/conversations", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    return prisma.conversation.create({
      data: {
        agentId: id,
        title: body?.title || "New Conversation",
      },
    });
  });

  app.get("/api/conversations/:id/messages", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
    });
  });

  // Memory
  app.get("/api/agents/:id/memory", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.memory.findMany({
      where: { agentId: id },
      orderBy: { createdAt: "desc" },
    });
  });

  app.post("/api/agents/:id/memory", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    await storeMemory(id, body.content, body.type || "note", { ticketId: body.ticketId });
    return { success: true };
  });

  app.post("/api/agents/:id/memory/search", async (req) => {
    const { id } = req.params as { id: string };
    const { query, limit } = req.body as { query: string; limit?: number };
    return searchMemory(id, query, limit || 8);
  });
}
