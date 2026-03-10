import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/api/dashboard", async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const [agents, skills, todayEvents, weekEvents, pendingTasks, overdueTasks, pendingReminders, recentDone] = await Promise.all([
      prisma.agent.count({ where: { enabled: true } }),
      prisma.skill.count(),
      prisma.calendarEvent.findMany({
        where: { startAt: { gte: todayStart, lt: todayEnd } },
        orderBy: { startAt: "asc" }, take: 5,
      }),
      prisma.calendarEvent.findMany({
        where: { startAt: { gte: todayStart, lt: weekEnd } },
        orderBy: { startAt: "asc" }, take: 10,
      }),
      prisma.ticket.findMany({
        where: { status: { in: ["queued", "in_progress"] } },
        include: { agent: { select: { name: true } } },
        orderBy: [{ priority: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
        take: 8,
      }),
      prisma.ticket.findMany({
        where: { status: { in: ["queued", "in_progress"] }, dueAt: { lt: now } },
        orderBy: { dueAt: "asc" }, take: 5,
      }),
      prisma.reminder.findMany({
        where: { status: "pending", dueAt: { gte: todayStart, lt: todayEnd } },
        orderBy: { dueAt: "asc" },
      }),
      prisma.ticket.findMany({
        where: { status: "done", updatedAt: { gte: todayStart } },
        orderBy: { updatedAt: "desc" }, take: 5,
      }),
    ]);

    return {
      agents, skills, runtimeStatus: "running",
      todayEvents, weekEvents, pendingTasks, overdueTasks,
      pendingReminders, recentDone,
    };
  });
}
