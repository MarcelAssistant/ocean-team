import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { prisma } from "../db.js";
import { log } from "../logger.js";

async function getEmailConfig() {
  const keys = [
    "email_imap_host", "email_imap_port", "email_imap_user", "email_imap_pass",
    "email_smtp_host", "email_smtp_port", "email_smtp_user", "email_smtp_pass",
    "email_from_address", "email_from_name",
  ];
  const settings = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const cfg: Record<string, string> = {};
  for (const s of settings) cfg[s.key] = s.value;
  return cfg;
}

export async function syncInbox(): Promise<number> {
  const cfg = await getEmailConfig();
  if (!cfg.email_imap_host || !cfg.email_imap_user || !cfg.email_imap_pass) {
    throw new Error("IMAP not configured");
  }

  const client = new ImapFlow({
    host: cfg.email_imap_host,
    port: parseInt(cfg.email_imap_port || "993"),
    secure: true,
    auth: { user: cfg.email_imap_user, pass: cfg.email_imap_pass },
    logger: false,
  });

  let count = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Fetch last 20 unseen messages
      const messages = client.fetch({ seen: false }, {
        envelope: true,
        source: true,
        bodyStructure: true,
      });

      for await (const msg of messages) {
        const env = msg.envelope;
        const messageId = env.messageId || msg.uid?.toString() || "";

        const existing = await prisma.emailMessage.findFirst({
          where: { messageId },
        });
        if (existing) continue;

        const from = env.from?.[0] ? `${env.from[0].name || ""} <${env.from[0].address || ""}>`.trim() : "Unknown";
        const to = env.to?.map((t: any) => t.address).join(", ") || "";
        const subject = env.subject || "(no subject)";
        const date = env.date || new Date();

        // Extract text body from source
        let body = "";
        const attachmentList: { name: string; type: string; size: number }[] = [];

        if (msg.source) {
          const raw = msg.source.toString();
          // Simple text extraction — get text between boundaries or plain text
          const textMatch = raw.match(/Content-Type: text\/plain[\s\S]*?\r\n\r\n([\s\S]*?)(?:\r\n--|\r\n\.\r\n|$)/i);
          body = textMatch ? textMatch[1].trim() : raw.slice(0, 2000);
        }

        if (msg.bodyStructure) {
          extractAttachments(msg.bodyStructure, attachmentList);
        }

        await prisma.emailMessage.create({
          data: {
            messageId,
            from,
            to,
            subject,
            body: body.slice(0, 10000),
            date: new Date(date),
            folder: "INBOX",
            isRead: false,
            attachments: JSON.stringify(attachmentList),
            direction: "inbound",
          },
        });
        count++;
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (e: any) {
    await log("error", "email", `IMAP sync error: ${e.message}`);
    throw e;
  }

  if (count > 0) {
    await log("info", "email", `Synced ${count} new email(s) from inbox`);
  }
  return count;
}

function extractAttachments(part: any, list: { name: string; type: string; size: number }[]) {
  if (part.disposition === "attachment" && part.parameters?.name) {
    list.push({
      name: part.parameters.name,
      type: `${part.type}/${part.subtype}`,
      size: part.size || 0,
    });
  }
  if (part.childNodes) {
    for (const child of part.childNodes) {
      extractAttachments(child, list);
    }
  }
}

export async function sendEmail(to: string, subject: string, body: string, html?: string): Promise<string> {
  const cfg = await getEmailConfig();
  if (!cfg.email_smtp_host || !cfg.email_smtp_user || !cfg.email_smtp_pass) {
    throw new Error("SMTP not configured. Add email settings first.");
  }

  const transporter = nodemailer.createTransport({
    host: cfg.email_smtp_host,
    port: parseInt(cfg.email_smtp_port || "587"),
    secure: parseInt(cfg.email_smtp_port || "587") === 465,
    auth: { user: cfg.email_smtp_user, pass: cfg.email_smtp_pass },
  });

  const fromName = cfg.email_from_name || "ZEUS";
  const fromAddr = cfg.email_from_address || cfg.email_smtp_user;

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromAddr}>`,
    to,
    subject,
    text: body,
    html: html || undefined,
  });

  await prisma.emailMessage.create({
    data: {
      messageId: info.messageId || "",
      from: fromAddr,
      to,
      subject,
      body,
      htmlBody: html || "",
      direction: "outbound",
    },
  });

  await log("info", "email", `Email sent to ${to}: ${subject}`);
  return info.messageId;
}

export async function parseAttachment(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop();

  if (ext === "pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === "xlsx" || ext === "xls") {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const results: string[] = [];
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      results.push(`--- Sheet: ${name} ---\n${csv}`);
    }
    return results.join("\n\n");
  }

  return `[Cannot parse .${ext} files — only PDF and Excel supported]`;
}

export async function testImapConnection(): Promise<{ success: boolean; error?: string; count?: number }> {
  const cfg = await getEmailConfig();
  if (!cfg.email_imap_host) return { success: false, error: "IMAP host not configured" };

  try {
    const client = new ImapFlow({
      host: cfg.email_imap_host,
      port: parseInt(cfg.email_imap_port || "993"),
      secure: true,
      auth: { user: cfg.email_imap_user, pass: cfg.email_imap_pass },
      logger: false,
    });
    await client.connect();
    const mailbox = await client.mailboxOpen("INBOX");
    const count = mailbox.exists;
    await client.logout();
    return { success: true, count };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function testSmtpConnection(): Promise<{ success: boolean; error?: string }> {
  const cfg = await getEmailConfig();
  if (!cfg.email_smtp_host) return { success: false, error: "SMTP host not configured" };

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.email_smtp_host,
      port: parseInt(cfg.email_smtp_port || "587"),
      secure: parseInt(cfg.email_smtp_port || "587") === 465,
      auth: { user: cfg.email_smtp_user, pass: cfg.email_smtp_pass },
    });
    await transporter.verify();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
