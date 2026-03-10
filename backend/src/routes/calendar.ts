import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function calendarRoutes(app: FastifyInstance) {
  app.get("/api/calendar", async (req) => {
    const query = req.query as { start?: string; end?: string };
    const where: any = {};
    if (query.start) where.startAt = { gte: new Date(query.start) };
    if (query.end) where.startAt = { ...where.startAt, lte: new Date(query.end) };
    return prisma.calendarEvent.findMany({ where, orderBy: { startAt: "asc" } });
  });

  app.post("/api/calendar", async (req) => {
    const body = req.body as any;
    return prisma.calendarEvent.create({
      data: {
        title: body.title,
        description: body.description || "",
        startAt: new Date(body.startAt),
        endAt: body.endAt ? new Date(body.endAt) : null,
        allDay: body.allDay || false,
        location: body.location || "",
        source: body.source || "manual",
        sourceId: body.sourceId || "",
        color: body.color || "",
      },
    });
  });

  app.put("/api/calendar/:id", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const data: any = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.startAt !== undefined) data.startAt = new Date(body.startAt);
    if (body.endAt !== undefined) data.endAt = body.endAt ? new Date(body.endAt) : null;
    if (body.allDay !== undefined) data.allDay = body.allDay;
    if (body.location !== undefined) data.location = body.location;
    if (body.color !== undefined) data.color = body.color;
    return prisma.calendarEvent.update({ where: { id }, data });
  });

  app.delete("/api/calendar/:id", async (req) => {
    const { id } = req.params as { id: string };
    await prisma.calendarEvent.delete({ where: { id } });
    return { success: true };
  });
}
