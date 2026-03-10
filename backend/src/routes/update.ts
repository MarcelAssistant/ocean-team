import { FastifyInstance } from "fastify";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { log } from "../logger.js";

const ZEUS_ROOT = path.resolve(import.meta.dirname, "../../..");

function readVersionFile(filePath: string): any {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return { version: "unknown", changelog: [] };
  }
}

export async function updateRoutes(app: FastifyInstance) {
  // Get current version + changelog
  app.get("/api/version", async () => {
    const versionFile = path.join(ZEUS_ROOT, "version.json");
    const current = readVersionFile(versionFile);
    return { current: current.version, releasedAt: current.releasedAt, changelog: current.changelog };
  });

  // Check for updates (git fetch + compare)
  app.post("/api/version/check", async () => {
    try {
      execSync("git fetch origin", { cwd: ZEUS_ROOT, timeout: 15000, stdio: "pipe" });

      const localHash = execSync("git rev-parse HEAD", { cwd: ZEUS_ROOT, stdio: "pipe" }).toString().trim();
      const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: ZEUS_ROOT, stdio: "pipe" }).toString().trim();
      const remoteHash = execSync(`git rev-parse origin/${branch}`, { cwd: ZEUS_ROOT, stdio: "pipe" }).toString().trim();

      const upToDate = localHash === remoteHash;

      let remoteChangelog: any[] = [];
      if (!upToDate) {
        try {
          const remoteVersionRaw = execSync(`git show origin/${branch}:version.json`, { cwd: ZEUS_ROOT, stdio: "pipe" }).toString();
          const remoteVersion = JSON.parse(remoteVersionRaw);
          remoteChangelog = remoteVersion.changelog || [];
        } catch {}
      }

      const currentVersion = readVersionFile(path.join(ZEUS_ROOT, "version.json"));
      const commitsAhead = upToDate ? 0 : parseInt(
        execSync(`git rev-list HEAD..origin/${branch} --count`, { cwd: ZEUS_ROOT, stdio: "pipe" }).toString().trim()
      );

      return {
        upToDate,
        currentVersion: currentVersion.version,
        remoteChangelog,
        commitsAhead,
        branch,
      };
    } catch (e: any) {
      return { upToDate: true, error: e.message };
    }
  });

  // Perform update: git pull + pnpm build + restart
  app.post("/api/version/update", async () => {
    try {
      await log("info", "update", "Starting self-update...");

      // Git pull
      const pullResult = execSync("git pull", { cwd: ZEUS_ROOT, timeout: 30000, stdio: "pipe" }).toString();
      await log("info", "update", `Git pull: ${pullResult.trim()}`);

      // Install deps
      execSync("pnpm install", { cwd: ZEUS_ROOT, timeout: 120000, stdio: "pipe" });
      await log("info", "update", "Dependencies installed");

      // Run migrations
      execSync("npx prisma migrate deploy --schema prisma/schema.prisma", {
        cwd: path.join(ZEUS_ROOT, "backend"),
        timeout: 30000,
        stdio: "pipe",
        env: { ...process.env },
      });
      await log("info", "update", "Database migrations applied");

      // Build frontend
      execSync("pnpm build", { cwd: ZEUS_ROOT, timeout: 60000, stdio: "pipe" });
      await log("info", "update", "Frontend rebuilt");

      // Read new version
      const newVersion = readVersionFile(path.join(ZEUS_ROOT, "version.json"));
      await log("info", "update", `Updated to v${newVersion.version}`);

      // Restart service (the response will be sent before restart kills this process)
      setTimeout(() => {
        try {
          execSync("sudo systemctl restart zeus", { timeout: 10000, stdio: "pipe" });
        } catch {
          process.exit(0);
        }
      }, 1000);

      return {
        success: true,
        version: newVersion.version,
        message: `Updated to v${newVersion.version}. Restarting...`,
      };
    } catch (e: any) {
      await log("error", "update", `Update failed: ${e.message}`);
      return { success: false, error: e.message };
    }
  });
}
