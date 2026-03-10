import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function logRoutes(app: FastifyInstance) {
  app.get("/api/logs", async (req) => {
    const query = req.query as { limit?: string; level?: string; source?: string };
    const take = Math.min(parseInt(query.limit || "100"), 500);
    const where: any = {};
    if (query.level) where.level = query.level;
    if (query.source) where.source = query.source;
    return prisma.logEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
    });
  });

  app.delete("/api/logs", async () => {
    await prisma.logEntry.deleteMany();
    return { success: true };
  });
}
