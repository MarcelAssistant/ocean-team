import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { chatWithAgent } from "../services/chat.js";
import { log } from "../logger.js";

export async function automationRoutes(app: FastifyInstance) {
  app.get("/api/automations", async () => {
    return prisma.automation.findMany({ orderBy: { createdAt: "desc" } });
  });

  app.get("/api/automations/:id", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.automation.findUniqueOrThrow({ where: { id } });
  });

  app.post("/api/automations", async (req) => {
    const body = req.body as any;
    const automation = await prisma.automation.create({
      data: {
        what: body.what || "",
        systems: body.systems || "",
        frequency: body.frequency || "",
        dataSource: body.dataSource || "",
        delivery: body.delivery || "",
        status: "pending",
      },
    });

    // Create a ticket for the Orchestrator to implement this automation
    const orchestrator = await prisma.agent.findFirst({
      where: { id: "orchestrator-001" },
    });

    if (orchestrator) {
      const ticket = await prisma.ticket.create({
        data: {
          title: `Automation: ${body.what}`,
          description: [
            `Set up the following automation:`,
            ``,
            `**What:** ${body.what}`,
            `**Systems:** ${body.systems || "N/A"}`,
            `**Frequency:** ${body.frequency || "N/A"}`,
            `**Data Source:** ${body.dataSource || "N/A"}`,
            `**Delivery:** ${body.delivery || "N/A"}`,
            ``,
            `Create the necessary scheduled tasks, verify the setup works, and confirm completion.`,
          ].join("\n"),
          priority: "high",
          status: "queued",
          agentId: orchestrator.id,
          output: "",
        },
      });

      await prisma.automation.update({
        where: { id: automation.id },
        data: { ticketId: ticket.id, status: "processing" },
      });

      await log("info", "automation", `Automation created and ticket assigned: "${body.what}"`, {
        automationId: automation.id, ticketId: ticket.id,
      });
    }

    return automation;
  });

  app.put("/api/automations/:id", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const data: any = {};
    for (const key of ["what", "systems", "frequency", "dataSource", "delivery", "status", "testResult"]) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    return prisma.automation.update({ where: { id }, data });
  });

  // Test an automation
  app.post("/api/automations/:id/test", async (req) => {
    const { id } = req.params as { id: string };
    const automation = await prisma.automation.findUniqueOrThrow({ where: { id } });

    const orchestrator = await prisma.agent.findFirst({ where: { id: "orchestrator-001" } });
    if (!orchestrator) {
      return { success: false, error: "Orchestrator not found" };
    }

    const conv = await prisma.conversation.create({
      data: { agentId: orchestrator.id, title: `Test automation: ${automation.what}` },
    });

    try {
      const result = await chatWithAgent(orchestrator.id, conv.id, [
        `Test the following automation and report whether it would work correctly:`,
        ``,
        `What: ${automation.what}`,
        `Systems: ${automation.systems}`,
        `Frequency: ${automation.frequency}`,
        `Data Source: ${automation.dataSource}`,
        `Delivery: ${automation.delivery}`,
        ``,
        `Verify feasibility, check if required skills and agents are available, and confirm readiness.`,
      ].join("\n"));

      const testResult = result.message.content;
      await prisma.automation.update({
        where: { id },
        data: { testResult, status: "tested" },
      });

      return { success: true, testResult };
    } catch (e: any) {
      const errorMsg = `Test failed: ${e.message}`;
      await prisma.automation.update({
        where: { id },
        data: { testResult: errorMsg, status: "failed" },
      });
      return { success: false, error: errorMsg };
    }
  });

  // Confirm automation is active
  app.post("/api/automations/:id/confirm", async (req) => {
    const { id } = req.params as { id: string };
    await prisma.automation.update({
      where: { id },
      data: { status: "active" },
    });
    await log("info", "automation", `Automation ${id} confirmed as active`);
    return { success: true };
  });

  app.delete("/api/automations/:id", async (req) => {
    const { id } = req.params as { id: string };
    await prisma.automation.delete({ where: { id } });
    return { success: true };
  });

  // Scheduled tasks CRUD
  app.get("/api/scheduled-tasks", async () => {
    return prisma.scheduledTask.findMany({
      include: { agent: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
  });

  app.put("/api/scheduled-tasks/:id", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const data: any = {};
    if (body.enabled !== undefined) data.enabled = body.enabled;
    if (body.intervalMin !== undefined) data.intervalMin = body.intervalMin;
    return prisma.scheduledTask.update({ where: { id }, data });
  });
}
