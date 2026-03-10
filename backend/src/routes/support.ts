import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { log } from "../logger.js";
import nodemailer from "nodemailer";

const SUPPORT_EMAIL = "support.ocean@zephyre.com";

export async function supportRoutes(app: FastifyInstance) {
  app.post("/api/support/ticket", async (req) => {
    const { subject, description, category } = req.body as {
      subject: string;
      description: string;
      category?: string;
    };

    if (!subject || !description) {
      return { success: false, error: "Subject and description are required." };
    }

    // Get user info
    const userName = (await prisma.setting.findUnique({ where: { key: "user_name" } }))?.value || "Unknown";
    const assistantName = (await prisma.setting.findUnique({ where: { key: "assistant_name" } }))?.value || "Ocean";
    const vmAddress = (await prisma.setting.findUnique({ where: { key: "vm_address" } }))?.value || "";

    // Build email body
    const body = [
      `Ocean Support Ticket`,
      `═══════════════════`,
      ``,
      `User: ${userName}`,
      `Instance: ${assistantName}`,
      `VM: ${vmAddress}`,
      `Category: ${category || "General"}`,
      `Date: ${new Date().toISOString()}`,
      ``,
      `Subject: ${subject}`,
      ``,
      `Description:`,
      description,
      ``,
      `---`,
      `Sent from Ocean Agent Orchestrator`,
    ].join("\n");

    // Try to send via email if configured
    let emailSent = false;
    try {
      const smtpHost = (await prisma.setting.findUnique({ where: { key: "email_smtp_host" } }))?.value;
      const smtpPort = (await prisma.setting.findUnique({ where: { key: "email_smtp_port" } }))?.value || "587";
      const smtpUser = (await prisma.setting.findUnique({ where: { key: "email_smtp_user" } }))?.value;
      const smtpPass = (await prisma.setting.findUnique({ where: { key: "email_smtp_pass" } }))?.value;
      const fromAddr = (await prisma.setting.findUnique({ where: { key: "email_from_address" } }))?.value || smtpUser;
      const fromName = (await prisma.setting.findUnique({ where: { key: "email_from_name" } }))?.value || "OCEAN";

      if (smtpHost && smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort),
          secure: parseInt(smtpPort) === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });

        await transporter.sendMail({
          from: `"${fromName}" <${fromAddr}>`,
          to: SUPPORT_EMAIL,
          subject: `[Ocean Support] ${subject}`,
          text: body,
        });

        emailSent = true;
      }
    } catch (e: any) {
      await log("warn", "support", `Could not email support ticket: ${e.message}`);
    }

    // Always log the ticket locally
    await log("info", "support", `Support ticket: ${subject}`, {
      category, userName, emailSent,
    });

    // Create a local ticket too
    await prisma.ticket.create({
      data: {
        title: `[Support] ${subject}`,
        description: `${description}\n\n---\nCategory: ${category || "General"}\nEmail sent: ${emailSent ? "Yes" : "No (email not configured)"}`,
        priority: "high",
        status: emailSent ? "done" : "queued",
        output: emailSent ? `Sent to ${SUPPORT_EMAIL}` : "Email not configured — ticket logged locally only.",
      },
    });

    return {
      success: true,
      emailSent,
      message: emailSent
        ? `Support ticket sent to ${SUPPORT_EMAIL}`
        : "Ticket saved locally. Configure email in Settings to send it to support.",
    };
  });
}
