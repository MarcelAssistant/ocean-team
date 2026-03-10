import { FastifyInstance } from "fastify";
import { chatWithAgent } from "../services/chat.js";

export async function chatRoutes(app: FastifyInstance) {
  app.post("/api/agents/:id/chat", async (req) => {
    const { id } = req.params as { id: string };
    const { conversationId, message } = req.body as {
      conversationId: string;
      message: string;
    };

    if (!message?.trim()) {
      throw new Error("Message is required");
    }

    const result = await chatWithAgent(id, conversationId, message);
    return result;
  });
}
