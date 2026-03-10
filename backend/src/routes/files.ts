import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { log } from "../logger.js";
import { getDataDir } from "../services/paths.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
const MAX_STORAGE = 1024 * 1024 * 1024; // 1GB total

function getWorkspaceDir(): string {
  const dir = path.join(getDataDir(), "workspace");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getStorageUsed(): number {
  const dir = getWorkspaceDir();
  let total = 0;
  try {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const stat = fs.statSync(path.join(dir, f));
      if (stat.isFile()) total += stat.size;
    }
  } catch {}
  return total;
}

export async function fileRoutes(app: FastifyInstance) {
  // Upload a file
  app.post("/api/files/upload", async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: "No file provided" });

    const buffer = await data.toBuffer();

    if (buffer.length > MAX_FILE_SIZE) {
      return reply.status(400).send({ error: `File too large. Maximum is 5MB.` });
    }

    const used = getStorageUsed();
    if (used + buffer.length > MAX_STORAGE) {
      await log("error", "files", "Storage limit reached (1GB). Contact Cedric to fix this.");
      return reply.status(400).send({
        error: "Storage limit reached (1GB). Please contact Cedric to resolve this.",
        storageUsed: used,
        storageLimit: MAX_STORAGE,
      });
    }

    const ext = path.extname(data.filename || "").toLowerCase();
    const id = crypto.randomBytes(8).toString("hex");
    const storedName = `${id}${ext}`;
    const filePath = path.join(getWorkspaceDir(), storedName);

    fs.writeFileSync(filePath, buffer);

    // Parse content from supported formats
    let textContent = "";
    try {
      if (ext === ".pdf") {
        const pdfParse = (await import("pdf-parse")).default;
        const parsed = await pdfParse(buffer);
        textContent = parsed.text;
      } else if (ext === ".xlsx" || ext === ".xls") {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(buffer, { type: "buffer" });
        const sheets: string[] = [];
        for (const name of wb.SheetNames) {
          sheets.push(`[${name}]\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}`);
        }
        textContent = sheets.join("\n\n");
      } else if (ext === ".txt" || ext === ".md" || ext === ".csv" || ext === ".json") {
        textContent = buffer.toString("utf-8");
      } else {
        textContent = `[Binary file: ${data.filename}, ${buffer.length} bytes]`;
      }
    } catch (e: any) {
      textContent = `[Could not parse ${data.filename}: ${e.message}]`;
    }

    await log("info", "files", `File uploaded: ${data.filename} (${(buffer.length / 1024).toFixed(1)}KB)`, { storedName });

    return {
      id,
      filename: data.filename,
      storedName,
      size: buffer.length,
      textContent: textContent.slice(0, 50000),
      storageUsed: used + buffer.length,
      storageLimit: MAX_STORAGE,
    };
  });

  // List files
  app.get("/api/files", async () => {
    const dir = getWorkspaceDir();
    const files: any[] = [];
    try {
      for (const f of fs.readdirSync(dir)) {
        const stat = fs.statSync(path.join(dir, f));
        if (stat.isFile()) {
          files.push({ name: f, size: stat.size, createdAt: stat.birthtime });
        }
      }
    } catch {}
    files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { files, storageUsed: getStorageUsed(), storageLimit: MAX_STORAGE };
  });

  // Download a file
  app.get("/api/files/:name", async (req, reply) => {
    const { name } = req.params as { name: string };
    const filePath = path.join(getWorkspaceDir(), name);
    if (!fs.existsSync(filePath)) return reply.status(404).send({ error: "File not found" });
    return reply.sendFile(name, getWorkspaceDir());
  });

  // Storage status
  app.get("/api/files/storage", async () => {
    return { storageUsed: getStorageUsed(), storageLimit: MAX_STORAGE };
  });
}
