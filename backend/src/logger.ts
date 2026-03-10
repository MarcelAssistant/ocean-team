import { prisma } from "./db.js";
import fs from "fs";
import path from "path";
import { getDataDir } from "./services/paths.js";

export async function log(
  level: "info" | "warn" | "error" | "debug",
  source: string,
  message: string,
  meta: Record<string, unknown> = {}
) {
  try {
    const logDir = path.join(getDataDir(), "logs");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] [${source}] ${message}\n`;
    fs.appendFileSync(path.join(logDir, `${new Date().toISOString().slice(0, 10)}.log`), line);
  } catch {}

  try {
    await prisma.logEntry.create({
      data: { level, source, message, meta: JSON.stringify(meta) },
    });
  } catch {}
}
