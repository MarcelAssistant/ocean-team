import { prisma } from "../db.js";
import { log } from "../logger.js";

const SCHEDULER_INTERVAL = 30_000; // check every 30s

const BUILTIN_TASKS: Record<string, () => Promise<string>> = {
  health_check: async () => {
    const agents = await prisma.agent.count({ where: { enabled: true } });
    const queuedTickets = await prisma.ticket.count({ where: { status: "queued" } });
    const failedTickets = await prisma.ticket.count({ where: { status: "failed" } });
    const unresolvedGaps = await prisma.skillGap.count({ where: { resolved: false } });
    const msg = `Health: ${agents} active agents, ${queuedTickets} queued tickets, ${failedTickets} failed, ${unresolvedGaps} skill gaps`;
    await log("info", "system-agent", msg);
    return msg;
  },

  log_cleanup: async () => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const deleted = await prisma.logEntry.deleteMany({ where: { createdAt: { lt: cutoff } } });
    const msg = `Cleaned ${deleted.count} log entries older than 7 days`;
    await log("info", "system-agent", msg);
    return msg;
  },

  stale_ticket_check: async () => {
    const staleDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stale = await prisma.ticket.findMany({
      where: { status: "in_progress", updatedAt: { lt: staleDate } },
    });
    if (stale.length > 0) {
      for (const t of stale) {
        await prisma.ticket.update({
          where: { id: t.id },
          data: { status: "failed", output: "Marked as failed — stuck in_progress for >24h" },
        });
      }
      const msg = `Recovered ${stale.length} stale ticket(s)`;
      await log("warn", "system-agent", msg);
      return msg;
    }
    return "No stale tickets found";
  },

  email_sync: async () => {
    const cfg = await prisma.setting.findUnique({ where: { key: "email_imap_host" } });
    if (!cfg?.value) return "Skipped — IMAP not configured";
    try {
      const { syncInbox } = await import("./email.js");
      const count = await syncInbox();
      return `Synced ${count} new email(s)`;
    } catch (e: any) {
      return `Email sync failed: ${e.message}`;
    }
  },

  reminder_check: async () => {
    const now = new Date();
    const due = await prisma.reminder.findMany({
      where: { status: "pending", notified: false, dueAt: { lte: now } },
    });
    if (due.length === 0) return "No due reminders";

    const { createNotification } = await import("../routes/notifications.js");
    for (const r of due) {
      await createNotification("reminder", `Reminder: ${r.title}`, `Due: ${r.dueAt.toLocaleString()}`);
      await prisma.reminder.update({ where: { id: r.id }, data: { notified: true, status: "done" } });

      // Handle recurring
      if (r.recurring) {
        const next = new Date(r.dueAt);
        if (r.recurring === "daily") next.setDate(next.getDate() + 1);
        else if (r.recurring === "weekly") next.setDate(next.getDate() + 7);
        else if (r.recurring === "monthly") next.setMonth(next.getMonth() + 1);

        if (r.recurring) {
          await prisma.reminder.create({
            data: { title: r.title, dueAt: next, recurring: r.recurring },
          });
        }
      }
    }
    await log("info", "system-agent", `Processed ${due.length} reminder(s)`);
    return `${due.length} reminder(s) triggered`;
  },

  daily_digest: async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [completedTasks, upcomingEvents, pendingReminders] = await Promise.all([
      prisma.ticket.count({ where: { status: "done", updatedAt: { gte: today } } }),
      prisma.calendarEvent.count({ where: { startAt: { gte: today, lt: tomorrow } } }),
      prisma.reminder.count({ where: { status: "pending", dueAt: { gte: today, lt: tomorrow } } }),
    ]);

    const digest = `Daily digest: ${completedTasks} tasks done, ${upcomingEvents} events today, ${pendingReminders} reminders pending`;
    const { createNotification } = await import("../routes/notifications.js");
    await createNotification("digest", "Daily Summary", digest);
    await log("info", "system-agent", digest);
    return digest;
  },

  auto_backup: async () => {
    const { getDbPath, getDataDir } = await import("./paths.js");
    const pathMod = await import("path");
    const fs = await import("fs");
    const dbPath = getDbPath();
    const backupDir = pathMod.join(getDataDir(), "backups");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    if (!fs.existsSync(dbPath)) return "No database to backup";

    const name = `auto-${new Date().toISOString().slice(0, 10)}.db`;
    const dest = pathMod.join(backupDir, name);
    if (fs.existsSync(dest)) return "Today's backup already exists";

    fs.copyFileSync(dbPath, dest);

    const backups = fs.readdirSync(backupDir).filter((f: string) => f.startsWith("auto-")).sort().reverse();
    for (const old of backups.slice(7)) fs.unlinkSync(pathMod.join(backupDir, old));

    return `Backup created: ${name}`;
  },

  prompt_optimize: async () => {
    const { analyzeTokenUsage } = await import("./prompt-optimizer.js");
    return analyzeTokenUsage();
  },

  memory_prune: async () => {
    const { pruneMemories } = await import("./memory.js");
    const count = await pruneMemories();
    return count > 0 ? `Pruned ${count} old memories` : "No memories to prune";
  },

  split_large_tickets: async () => {
    const { splitTicketIntoStories } = await import("./split-ticket.js");
    const large = await prisma.ticket.findMany({
      where: {
        status: "queued",
        parentTicketId: null,
        description: { not: "" },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    let split = 0;
    for (const t of large) {
      if ((t.description?.length || 0) < 200) continue;
      try {
        const { created } = await splitTicketIntoStories(t.id);
        split += created;
      } catch {
        // Skip if split fails (e.g. already split)
      }
    }
    return split > 0 ? `Split ${split} ticket(s) into stories` : "No large tickets to split";
  },
};

async function runTask(task: any): Promise<void> {
  const handler = BUILTIN_TASKS[task.name];
  if (!handler) {
    await prisma.scheduledTask.update({
      where: { id: task.id },
      data: { lastRunAt: new Date(), lastResult: `Unknown task: ${task.name}` },
    });
    return;
  }

  try {
    const result = await handler();
    const nextRun = new Date(Date.now() + task.intervalMin * 60 * 1000);
    await prisma.scheduledTask.update({
      where: { id: task.id },
      data: { lastRunAt: new Date(), nextRunAt: nextRun, lastResult: result },
    });
  } catch (e: any) {
    await prisma.scheduledTask.update({
      where: { id: task.id },
      data: { lastRunAt: new Date(), lastResult: `Error: ${e.message}` },
    });
    await log("error", "scheduler", `Task "${task.name}" failed: ${e.message}`);
  }
}

export function startScheduler() {
  console.log("📅 Scheduler running");
  log("info", "scheduler", "Scheduler started");

  const loop = async () => {
    while (true) {
      try {
        const now = new Date();
        const dueTasks = await prisma.scheduledTask.findMany({
          where: {
            enabled: true,
            OR: [
              { nextRunAt: null },
              { nextRunAt: { lte: now } },
            ],
          },
        });

        for (const task of dueTasks) {
          await runTask(task);
        }
      } catch (e: any) {
        console.error("  [scheduler] Error:", e.message);
      }

      await new Promise((r) => setTimeout(r, SCHEDULER_INTERVAL));
    }
  };

  loop();
}
