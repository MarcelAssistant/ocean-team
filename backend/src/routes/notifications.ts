import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function notificationRoutes(app: FastifyInstance) {
  app.get("/api/notifications", async (req) => {
    const query = req.query as { unread?: string };
    const where: any = {};
    if (query.unread === "true") where.read = false;
    return prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });

  app.get("/api/notifications/count", async () => {
    const count = await prisma.notification.count({ where: { read: false } });
    return { count };
  });

  app.post("/api/notifications/:id/read", async (req) => {
    const { id } = req.params as { id: string };
    await prisma.notification.update({ where: { id }, data: { read: true } });
    return { success: true };
  });

  app.post("/api/notifications/read-all", async () => {
    await prisma.notification.updateMany({ where: { read: false }, data: { read: true } });
    return { success: true };
  });
}

export async function createNotification(type: string, title: string, body = "", link = "") {
  return prisma.notification.create({ data: { type, title, body, link } });
}
