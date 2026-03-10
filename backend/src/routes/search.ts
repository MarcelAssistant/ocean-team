import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function searchRoutes(app: FastifyInstance) {
  app.get("/api/search", async (req) => {
    const { q, limit } = req.query as { q: string; limit?: string };
    if (!q || q.length < 2) return { results: [] };

    const take = Math.min(parseInt(limit || "20"), 50);
    const term = `%${q}%`;

    const [tasks, memories, events, notes, conversations] = await Promise.all([
      prisma.ticket.findMany({
        where: { OR: [{ title: { contains: q } }, { description: { contains: q } }, { output: { contains: q } }] },
        take, orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, status: true, updatedAt: true },
      }),
      prisma.memory.findMany({
        where: { content: { contains: q } },
        take, orderBy: { createdAt: "desc" },
        select: { id: true, content: true, type: true, createdAt: true },
      }),
      prisma.calendarEvent.findMany({
        where: { OR: [{ title: { contains: q } }, { description: { contains: q } }] },
        take, orderBy: { startAt: "desc" },
        select: { id: true, title: true, startAt: true },
      }),
      prisma.note.findMany({
        where: { OR: [{ title: { contains: q } }, { content: { contains: q } }] },
        take, orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, content: true },
      }),
      prisma.conversation.findMany({
        where: { title: { contains: q } },
        take, orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, agentId: true, updatedAt: true },
      }),
    ]);

    const results: any[] = [];
    tasks.forEach((t) => results.push({ type: "task", id: t.id, title: t.title, subtitle: t.status, time: t.updatedAt }));
    events.forEach((e) => results.push({ type: "event", id: e.id, title: e.title, time: e.startAt }));
    notes.forEach((n) => results.push({ type: "note", id: n.id, title: n.title || n.content.slice(0, 60) }));
    memories.forEach((m) => results.push({ type: "memory", id: m.id, title: m.content.slice(0, 80), subtitle: m.type, time: m.createdAt }));
    conversations.forEach((c) => results.push({ type: "conversation", id: c.id, title: c.title, time: c.updatedAt }));

    return { results, query: q };
  });
}
