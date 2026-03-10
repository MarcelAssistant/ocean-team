import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function noteRoutes(app: FastifyInstance) {
  app.get("/api/notes", async () => {
    return prisma.note.findMany({ orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }] });
  });

  app.post("/api/notes", async (req) => {
    const { title, content, pinned, color } = req.body as any;
    return prisma.note.create({
      data: { title: title || "", content: content || "", pinned: pinned || false, color: color || "" },
    });
  });

  app.put("/api/notes/:id", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const data: any = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.content !== undefined) data.content = body.content;
    if (body.pinned !== undefined) data.pinned = body.pinned;
    if (body.color !== undefined) data.color = body.color;
    return prisma.note.update({ where: { id }, data });
  });

  app.delete("/api/notes/:id", async (req) => {
    const { id } = req.params as { id: string };
    await prisma.note.delete({ where: { id } });
    return { success: true };
  });
}
