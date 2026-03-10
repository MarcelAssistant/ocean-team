import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { syncInbox, sendEmail, testImapConnection, testSmtpConnection } from "../services/email.js";

export async function emailRoutes(app: FastifyInstance) {
  app.get("/api/emails", async (req) => {
    const query = req.query as { direction?: string; limit?: string };
    const where: any = {};
    if (query.direction) where.direction = query.direction;
    return prisma.emailMessage.findMany({
      where,
      orderBy: { date: "desc" },
      take: Math.min(parseInt(query.limit || "50"), 200),
    });
  });

  app.get("/api/emails/:id", async (req) => {
    const { id } = req.params as { id: string };
    const email = await prisma.emailMessage.findUniqueOrThrow({ where: { id } });
    if (!email.isRead) {
      await prisma.emailMessage.update({ where: { id }, data: { isRead: true } });
    }
    return email;
  });

  app.post("/api/emails/sync", async () => {
    try {
      const count = await syncInbox();
      return { success: true, count };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  app.post("/api/emails/send", async (req) => {
    const { to, subject, body, html } = req.body as any;
    if (!to || !subject) {
      return { success: false, error: "Both 'to' and 'subject' are required." };
    }
    try {
      const messageId = await sendEmail(to, subject, body || "", html);
      return { success: true, messageId };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  app.delete("/api/emails/:id", async (req) => {
    const { id } = req.params as { id: string };
    await prisma.emailMessage.delete({ where: { id } });
    return { success: true };
  });

  app.post("/api/emails/test-imap", async () => testImapConnection());
  app.post("/api/emails/test-smtp", async () => testSmtpConnection());
}
