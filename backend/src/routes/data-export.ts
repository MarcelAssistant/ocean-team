import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import fs from "fs";
import path from "path";
import { getDataDir, getDbPath } from "../services/paths.js";

export async function dataExportRoutes(app: FastifyInstance) {
  app.get("/api/export", async (_req, reply) => {
    const [agents, tickets, memories, conversations, messages, events, notes, reminders, automations, skills] = await Promise.all([
      prisma.agent.findMany(),
      prisma.ticket.findMany(),
      prisma.memory.findMany({ select: { id: true, agentId: true, type: true, content: true, createdAt: true } }),
      prisma.conversation.findMany(),
      prisma.message.findMany(),
      prisma.calendarEvent.findMany(),
      prisma.note.findMany(),
      prisma.reminder.findMany(),
      prisma.automation.findMany(),
      prisma.skill.findMany(),
    ]);

    const data = {
      exportedAt: new Date().toISOString(),
      version: "1.0.0",
      agents, tickets, memories, conversations, messages,
      calendarEvents: events, notes, reminders, automations, skills,
    };

    reply.header("Content-Type", "application/json");
    reply.header("Content-Disposition", `attachment; filename="zeus-export-${new Date().toISOString().slice(0, 10)}.json"`);
    return data;
  });

  app.post("/api/backup", async () => {
    const dbPath = getDbPath();
    const backupDir = path.join(getDataDir(), "backups");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const backupName = `zeus-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
    const backupPath = path.join(backupDir, backupName);

    if (!fs.existsSync(dbPath)) return { success: false, error: "Database not found" };

    fs.copyFileSync(dbPath, backupPath);
    return { success: true, backup: backupName, path: backupPath };
  });

  app.get("/api/backups", async () => {
    const backupDir = path.join(getDataDir(), "backups");
    if (!fs.existsSync(backupDir)) return { backups: [] };
    const files = fs.readdirSync(backupDir)
      .filter((f) => f.endsWith(".db"))
      .map((f) => {
        const stat = fs.statSync(path.join(backupDir, f));
        return { name: f, size: stat.size, createdAt: stat.birthtime };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { backups: files };
  });

  app.post("/api/backup/restore/:name", async (req) => {
    const { name } = req.params as { name: string };
    const backupDir = path.join(getDataDir(), "backups");
    const backupPath = path.join(backupDir, name);
    const dbPath = getDbPath();

    if (!fs.existsSync(backupPath)) return { success: false, error: "Backup not found" };

    const safetyName = `pre-restore-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
    fs.copyFileSync(dbPath, path.join(backupDir, safetyName));
    fs.copyFileSync(backupPath, dbPath);
    return { success: true, message: `Restored from ${name}. Restart the service to apply.` };
  });
}
