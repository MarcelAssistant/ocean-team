import { Telegraf } from "telegraf";
import { prisma } from "../db.js";
import { log } from "../logger.js";
import { chatWithAgent } from "./chat.js";
import crypto from "crypto";

let bot: Telegraf | null = null;
let botRunning = false;
let botUsername = "";

export function isBotRunning() {
  return botRunning;
}

export function getBotInfo() {
  return { running: botRunning, username: botUsername };
}

export async function startBot(): Promise<{ success: boolean; username?: string; error?: string }> {
  if (botRunning && bot) {
    return { success: true, username: botUsername };
  }

  const tokenSetting = await prisma.setting.findUnique({ where: { key: "telegram_bot_token" } });
  if (!tokenSetting?.value) {
    return { success: false, error: "No Telegram bot token configured. Add it in Settings." };
  }

  try {
    bot = new Telegraf(tokenSetting.value);

    // /start command — show welcome and instructions
    bot.start(async (ctx) => {
      await ctx.reply(
        `⚡ *ZEUS Agent Runtime*\n\n` +
        `This bot connects you to ZEUS agents.\n\n` +
        `To pair this chat with an agent, get a pairing code from the ZEUS dashboard and send it here:\n\n` +
        `\`/pair CODE\`\n\n` +
        `Once paired, any message you send will go directly to your agent.`,
        { parse_mode: "Markdown" }
      );
    });

    // /pair CODE — link this Telegram chat to an agent
    bot.command("pair", async (ctx) => {
      const code = ctx.message.text.split(/\s+/)[1]?.trim();
      if (!code) {
        await ctx.reply("Usage: /pair CODE\n\nGet a pairing code from the ZEUS dashboard → Agent → Telegram tab.");
        return;
      }

      const pairingCode = await prisma.telegramPairingCode.findUnique({ where: { code } });
      if (!pairingCode) {
        await ctx.reply("Invalid pairing code. Generate a new one from the ZEUS dashboard.");
        return;
      }

      if (pairingCode.expiresAt < new Date()) {
        await prisma.telegramPairingCode.delete({ where: { id: pairingCode.id } });
        await ctx.reply("This pairing code has expired. Generate a new one from the ZEUS dashboard.");
        return;
      }

      const chatId = String(ctx.chat.id);
      const chatTitle = ctx.chat.type === "private"
        ? `${ctx.from.first_name || ""} ${ctx.from.last_name || ""}`.trim()
        : (ctx.chat as any).title || `Chat ${chatId}`;

      // Create or update pairing
      await prisma.telegramPairing.upsert({
        where: { telegramChatId: chatId },
        update: { agentId: pairingCode.agentId, chatTitle },
        create: { telegramChatId: chatId, agentId: pairingCode.agentId, chatTitle },
      });

      // Clean up used code
      await prisma.telegramPairingCode.delete({ where: { id: pairingCode.id } });

      const agent = await prisma.agent.findUnique({ where: { id: pairingCode.agentId } });
      await ctx.reply(
        `✅ *Paired successfully!*\n\n` +
        `This chat is now connected to agent *${agent?.name || "Unknown"}*.\n` +
        `Any message you send here will be processed by this agent.\n\n` +
        `Commands:\n` +
        `/status — Check connection\n` +
        `/unpair — Disconnect from agent\n` +
        `/newchat — Start a fresh conversation`,
        { parse_mode: "Markdown" }
      );

      await log("info", "telegram", `Chat "${chatTitle}" paired with agent "${agent?.name}"`, {
        chatId, agentId: pairingCode.agentId,
      });
    });

    // /status — show current pairing
    bot.command("status", async (ctx) => {
      const chatId = String(ctx.chat.id);
      const pairing = await prisma.telegramPairing.findUnique({
        where: { telegramChatId: chatId },
        include: { agent: true },
      });

      if (!pairing) {
        await ctx.reply("This chat is not paired to any agent.\nUse /pair CODE to connect.");
        return;
      }

      await ctx.reply(
        `⚡ *ZEUS Status*\n\n` +
        `Agent: *${pairing.agent.name}*\n` +
        `Role: ${pairing.agent.role}\n` +
        `Model: ${pairing.agent.model}\n` +
        `Status: ${pairing.agent.enabled ? "✅ Active" : "❌ Disabled"}`,
        { parse_mode: "Markdown" }
      );
    });

    // /unpair — disconnect
    bot.command("unpair", async (ctx) => {
      const chatId = String(ctx.chat.id);
      const pairing = await prisma.telegramPairing.findUnique({ where: { telegramChatId: chatId } });
      if (!pairing) {
        await ctx.reply("This chat is not paired to any agent.");
        return;
      }

      await prisma.telegramPairing.delete({ where: { id: pairing.id } });
      await ctx.reply("Unpaired. This chat is no longer connected to a ZEUS agent.");
      await log("info", "telegram", `Chat unpaired`, { chatId });
    });

    // /newchat — start fresh conversation thread
    bot.command("newchat", async (ctx) => {
      const chatId = String(ctx.chat.id);
      const pairing = await prisma.telegramPairing.findUnique({ where: { telegramChatId: chatId } });
      if (!pairing) {
        await ctx.reply("This chat is not paired. Use /pair CODE first.");
        return;
      }

      // Clear conversation reference so the next message creates a new one
      await prisma.telegramPairing.update({
        where: { id: pairing.id },
        data: { conversationId: null },
      });
      await ctx.reply("Fresh conversation started. Your next message begins a new thread.");
    });

    // Handle all text messages — route to paired agent
    bot.on("text", async (ctx) => {
      // Ignore commands (already handled above)
      if (ctx.message.text.startsWith("/")) return;

      const chatId = String(ctx.chat.id);
      const pairing = await prisma.telegramPairing.findUnique({
        where: { telegramChatId: chatId },
        include: { agent: true },
      });

      if (!pairing) {
        await ctx.reply("This chat is not paired to any agent.\nUse /pair CODE to connect.");
        return;
      }

      if (!pairing.agent.enabled) {
        await ctx.reply(`Agent "${pairing.agent.name}" is currently disabled.`);
        return;
      }

      // Get or create a conversation for this Telegram chat
      let conversationId = pairing.conversationId;
      if (!conversationId) {
        const conv = await prisma.conversation.create({
          data: {
            agentId: pairing.agentId,
            title: `Telegram: ${pairing.chatTitle}`,
          },
        });
        conversationId = conv.id;
        await prisma.telegramPairing.update({
          where: { id: pairing.id },
          data: { conversationId },
        });
      }

      // Show "typing" indicator
      await ctx.sendChatAction("typing");

      try {
        const result = await chatWithAgent(pairing.agentId, conversationId, ctx.message.text);
        const response = result.message.content;

        // Telegram has a 4096 char limit per message — split if needed
        if (response.length <= 4096) {
          await ctx.reply(response, { parse_mode: "Markdown" }).catch(() =>
            ctx.reply(response)
          );
        } else {
          const chunks = splitMessage(response, 4096);
          for (const chunk of chunks) {
            await ctx.reply(chunk, { parse_mode: "Markdown" }).catch(() =>
              ctx.reply(chunk)
            );
          }
        }

        await log("info", "telegram", `Message processed for "${pairing.chatTitle}"`, {
          chatId, agentId: pairing.agentId,
        });
      } catch (e: any) {
        await ctx.reply(`Error: ${e.message}`);
        await log("error", "telegram", `Message error: ${e.message}`, { chatId });
      }
    });

    // Launch bot
    await bot.launch();
    const me = await bot.telegram.getMe();
    botUsername = me.username || "";
    botRunning = true;

    await log("info", "telegram", `Bot started: @${botUsername}`);
    console.log(`📱 Telegram bot running: @${botUsername}`);

    // Graceful stop
    const shutdown = () => {
      bot?.stop("SIGTERM");
      botRunning = false;
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);

    return { success: true, username: botUsername };
  } catch (e: any) {
    bot = null;
    botRunning = false;
    await log("error", "telegram", `Bot start failed: ${e.message}`);
    return { success: false, error: e.message };
  }
}

export async function stopBot(): Promise<{ success: boolean }> {
  if (bot) {
    bot.stop("manual");
    bot = null;
  }
  botRunning = false;
  botUsername = "";
  await log("info", "telegram", "Bot stopped");
  console.log("📱 Telegram bot stopped");
  return { success: true };
}

export async function generatePairingCode(agentId: string): Promise<string> {
  // Clean up expired codes
  await prisma.telegramPairingCode.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  // Generate a 6-character alphanumeric code
  const code = crypto.randomBytes(3).toString("hex").toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.telegramPairingCode.create({
    data: { code, agentId, expiresAt },
  });

  await log("info", "telegram", `Pairing code generated for agent ${agentId}: ${code}`, { agentId });
  return code;
}

function splitMessage(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt < maxLen / 2) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  return chunks;
}
