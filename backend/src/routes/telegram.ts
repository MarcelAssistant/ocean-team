import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import {
  startBot,
  stopBot,
  getBotInfo,
  generatePairingCode,
} from "../services/telegram.js";

export async function telegramRoutes(app: FastifyInstance) {
  // Bot status
  app.get("/api/telegram/status", async () => {
    return getBotInfo();
  });

  // Start bot
  app.post("/api/telegram/start", async () => {
    return startBot();
  });

  // Stop bot
  app.post("/api/telegram/stop", async () => {
    return stopBot();
  });

  // Generate pairing code for an agent
  app.post("/api/telegram/pair/:agentId", async (req) => {
    const { agentId } = req.params as { agentId: string };
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new Error("Agent not found");

    const code = await generatePairingCode(agentId);
    return { code, agentName: agent.name, expiresInMinutes: 10 };
  });

  // List all active pairings
  app.get("/api/telegram/pairings", async () => {
    return prisma.telegramPairing.findMany({
      include: { agent: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });
  });

  // Delete a pairing
  app.delete("/api/telegram/pairings/:id", async (req) => {
    const { id } = req.params as { id: string };
    await prisma.telegramPairing.delete({ where: { id } });
    return { success: true };
  });
}
