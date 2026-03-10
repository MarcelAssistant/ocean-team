import OpenAI from "openai";
import { prisma } from "../db.js";
import { log } from "../logger.js";

/** Split a ticket into smaller stories using gpt-4o-mini (same API key as sub-agents). */
export async function splitTicketIntoStories(ticketId: string): Promise<{ created: number; storyIds: string[] }> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error(`Ticket ${ticketId} not found`);
  if (ticket.parentTicketId) throw new Error("Cannot split a child ticket");

  const apiKey = (await prisma.setting.findUnique({ where: { key: "openai_api_key" } }))?.value;
  if (!apiKey) throw new Error("OpenAI API key not configured. Sub-agents and split use gpt-4o-mini.");

  const client = new OpenAI({ apiKey });
  const prompt = `Break this task into 3–5 smaller, actionable stories (agile methodology). Each story should be independently completable.

Task:
Title: ${ticket.title}
Description: ${ticket.description || "(none)"}

Return ONLY a valid JSON array, no other text. Format:
[{"title":"Story 1 title","description":"What to do"},{"title":"Story 2 title","description":"What to do"},...]`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 1024,
  });

  const content = completion.choices[0]?.message?.content?.trim() || "";
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  const jsonStr = jsonMatch ? jsonMatch[0] : content;
  let stories: { title: string; description: string }[];
  try {
    stories = JSON.parse(jsonStr);
  } catch {
    throw new Error("Could not parse stories from model response");
  }
  if (!Array.isArray(stories) || stories.length < 2) {
    throw new Error("Need at least 2 stories to split");
  }

  const project = ticket.project || ticket.category || "General";
  const storyIds: string[] = [];
  for (const s of stories) {
    const t = await prisma.ticket.create({
      data: {
        title: String(s.title || "Untitled story"),
        description: String(s.description || ""),
        priority: ticket.priority,
        category: ticket.category,
        project,
        parentTicketId: ticketId,
        status: "created",
        agentId: ticket.agentId,
        output: "",
        dueAt: ticket.dueAt,
      },
    });
    storyIds.push(t.id);
  }

  await log("info", "split_ticket", `Split "${ticket.title}" into ${storyIds.length} stories`, {
    ticketId,
    storyIds,
  });
  return { created: storyIds.length, storyIds };
}
