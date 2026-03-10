import { prisma } from "../db.js";
import { log } from "../logger.js";
import { chatWithAgent } from "./chat.js";
import { storeMemory } from "./memory.js";

const POLL_INTERVAL = 5000;

async function processNextTicket(): Promise<boolean> {
  const ticket = await prisma.ticket.findFirst({
    where: { status: "queued" },
    orderBy: [
      { priority: "asc" },
      { createdAt: "asc" },
    ],
    include: { agent: true },
  });

  if (!ticket) return false;

  await log("info", "worker", `Processing ticket: "${ticket.title}"`, { ticketId: ticket.id });
  console.log(`  [worker] Processing: "${ticket.title}"`);

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: "in_progress" },
  });

  try {
    if (!ticket.agent) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: "failed", output: "No agent assigned to this ticket." },
      });
      await log("warn", "worker", `Ticket "${ticket.title}" has no assigned agent`, { ticketId: ticket.id });
      return true;
    }

    // Create a dedicated conversation for this ticket
    const conversation = await prisma.conversation.create({
      data: {
        agentId: ticket.agent.id,
        title: `Ticket: ${ticket.title}`,
      },
    });

    const taskPrompt = [
      `You are processing a ticket assigned to you.`,
      ``,
      `**Title:** ${ticket.title}`,
      `**Description:** ${ticket.description || "(no description)"}`,
      `**Priority:** ${ticket.priority}`,
      ``,
      `Provide a thorough, actionable response. This is your deliverable for this task.`,
    ].join("\n");

    const result = await chatWithAgent(ticket.agent.id, conversation.id, taskPrompt);

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "done", output: result.message.content },
    });

    await storeMemory(
      ticket.agent.id,
      `Completed ticket "${ticket.title}": ${result.message.content.slice(0, 2000)}`,
      "ticket_result",
      { ticketId: ticket.id }
    );

    await log("info", "worker", `Ticket completed: "${ticket.title}"`, { ticketId: ticket.id });
    console.log(`  [worker] Completed: "${ticket.title}"`);
    return true;
  } catch (e: any) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "failed", output: `Error: ${e.message}` },
    });
    await log("error", "worker", `Ticket failed: ${e.message}`, { ticketId: ticket.id });
    console.error(`  [worker] Failed: "${ticket.title}" — ${e.message}`);
    return true;
  }
}

export function startWorker() {
  console.log(`⚙ ZEUS Worker running — polling every ${POLL_INTERVAL / 1000}s`);
  log("info", "worker", "Worker started");

  const loop = async () => {
    while (true) {
      try {
        const processed = await processNextTicket();
        if (!processed) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL));
        }
      } catch (e: any) {
        console.error("  [worker] Error:", e.message);
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      }
    }
  };

  // Run async without blocking the caller
  loop();
}
