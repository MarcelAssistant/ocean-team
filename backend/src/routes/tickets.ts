import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { chatWithAgent } from "../services/chat.js";
import { log } from "../logger.js";

export async function ticketRoutes(app: FastifyInstance) {
  app.get("/api/tickets", async (req) => {
    const query = req.query as { status?: string; agentId?: string; project?: string };
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.agentId) where.agentId = query.agentId;
    if (query.project) where.project = query.project;
    return prisma.ticket.findMany({
      where,
      include: { agent: true },
      orderBy: { createdAt: "desc" },
    });
  });

  app.get("/api/tickets/board", async () => {
    const tickets = await prisma.ticket.findMany({
      include: { agent: true },
      orderBy: { createdAt: "desc" },
    });
    const byProject = tickets.reduce((acc: Record<string, any[]>, t) => {
      const p = (t as any).project || t.category || "General";
      if (!acc[p]) acc[p] = [];
      acc[p].push(t);
      return acc;
    }, {});
    return { tickets, byProject };
  });

  app.get("/api/tickets/:id", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.ticket.findUniqueOrThrow({
      where: { id },
      include: { agent: true },
    });
  });

  app.post("/api/tickets", async (req) => {
    const body = req.body as any;
    return prisma.ticket.create({
      data: {
        title: body.title,
        description: body.description || "",
        priority: body.priority || "medium",
        category: body.category || "Personal",
        project: body.project || body.category || "General",
        parentTicketId: body.parentTicketId || null,
        status: body.status || "queued",
        agentId: body.agentId || null,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        output: "",
      },
    });
  });

  app.put("/api/tickets/:id", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const data: any = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.status !== undefined) data.status = body.status;
    if (body.agentId !== undefined) data.agentId = body.agentId;
    if (body.output !== undefined) data.output = body.output;
    if (body.category !== undefined) data.category = body.category;
    if (body.project !== undefined) data.project = body.project;
    if (body.dueAt !== undefined) data.dueAt = body.dueAt ? new Date(body.dueAt) : null;
    return prisma.ticket.update({ where: { id }, data });
  });

  app.delete("/api/tickets/:id", async (req) => {
    const { id } = req.params as { id: string };
    await prisma.ticket.delete({ where: { id } });
    return { success: true };
  });

  app.post("/api/tickets/:id/split", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const { splitTicketIntoStories } = await import("../services/split-ticket.js");
      const { created, storyIds } = await splitTicketIntoStories(id);
      return { success: true, created, storyIds };
    } catch (e: any) {
      return reply.status(400).send({ success: false, error: e.message });
    }
  });

  app.post("/api/tickets/process", async () => {
    const ticket = await prisma.ticket.findFirst({
      where: { status: "queued" },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      include: { agent: true },
    });

    if (!ticket) return { processed: false, message: "No queued tickets" };

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "in_progress" },
    });

    try {
      if (!ticket.agent) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { status: "failed", output: "No agent assigned." },
        });
        return { processed: true, ticketId: ticket.id, status: "failed" };
      }

      let conversation = await prisma.conversation.findFirst({
        where: { agentId: ticket.agent.id },
        orderBy: { createdAt: "desc" },
      });
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: { agentId: ticket.agent.id, title: `Ticket: ${ticket.title}` },
        });
      }

      const prompt = `Process this ticket:\n\nTitle: ${ticket.title}\nDescription: ${ticket.description}\nPriority: ${ticket.priority}`;
      const result = await chatWithAgent(ticket.agent.id, conversation.id, prompt);

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: "done", output: result.message.content },
      });

      await log("info", "worker", `Ticket processed: ${ticket.title}`, { ticketId: ticket.id });
      return { processed: true, ticketId: ticket.id, status: "done" };
    } catch (e: any) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: "failed", output: `Error: ${e.message}` },
      });
      return { processed: true, ticketId: ticket.id, status: "failed", error: e.message };
    }
  });
}
