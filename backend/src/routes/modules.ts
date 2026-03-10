import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { log } from "../logger.js";
import fs from "fs";
import path from "path";

const MODULES_DIR = path.resolve(import.meta.dirname, "../../../modules");

export async function moduleRoutes(app: FastifyInstance) {
  app.get("/api/modules", async () => {
    const modules = await prisma.module.findMany({ orderBy: { name: "asc" } });
    return modules.map((m) => ({
      ...m,
      manifest: JSON.parse(m.manifest || "{}"),
      config: JSON.parse(m.config || "{}"),
    }));
  });

  app.get("/api/modules/:slug", async (req) => {
    const { slug } = req.params as { slug: string };
    const m = await prisma.module.findUniqueOrThrow({ where: { slug } });
    return { ...m, manifest: JSON.parse(m.manifest || "{}"), config: JSON.parse(m.config || "{}") };
  });

  // Save module configuration (API keys, credentials, etc.)
  app.put("/api/modules/:slug/config", async (req) => {
    const { slug } = req.params as { slug: string };
    const body = req.body as Record<string, string>;

    const mod = await prisma.module.findUniqueOrThrow({ where: { slug } });
    const manifest = JSON.parse(mod.manifest || "{}");
    const currentConfig = JSON.parse(mod.config || "{}");

    // Merge new values into existing config
    const newConfig = { ...currentConfig, ...body };

    // Validate required fields
    const missing: string[] = [];
    if (manifest.settings) {
      for (const field of manifest.settings) {
        if (field.required && !newConfig[field.key]) {
          missing.push(field.label || field.key);
        }
      }
    }

    await prisma.module.update({
      where: { slug },
      data: { config: JSON.stringify(newConfig) },
    });

    // Also store in Settings table with module prefix for skill access
    for (const [key, value] of Object.entries(body)) {
      const settingKey = `module_${slug}_${key}`;
      await prisma.setting.upsert({
        where: { key: settingKey },
        update: { value: String(value) },
        create: { key: settingKey, value: String(value) },
      });
    }

    await log("info", "modules", `Configuration updated for "${slug}"`, { slug });

    const configured = missing.length === 0;
    return { success: true, configured, missing };
  });

  // Install a module
  app.post("/api/modules/:slug/install", async (req) => {
    const { slug } = req.params as { slug: string };
    const mod = await prisma.module.findUniqueOrThrow({ where: { slug } });

    if (mod.status === "installed") {
      return { success: true, message: "Already installed" };
    }

    const manifest = JSON.parse(mod.manifest || "{}");

    const moduleDir = path.join(MODULES_DIR, slug);
    if (!fs.existsSync(moduleDir)) {
      fs.mkdirSync(moduleDir, { recursive: true });
    }

    if (manifest.agents) {
      for (const agentDef of manifest.agents) {
        const existing = await prisma.agent.findFirst({ where: { name: agentDef.name, moduleSlug: slug } });
        if (!existing) {
          await prisma.agent.create({
            data: {
              name: agentDef.name,
              description: agentDef.description || "",
              role: agentDef.role || "",
              mission: agentDef.mission || "",
              systemPrompt: agentDef.systemPrompt || "You are a helpful assistant.",
              model: agentDef.model || "venice-uncensored",
              temperature: agentDef.temperature ?? 0.7,
              maxTokens: agentDef.maxTokens ?? 2048,
              enabled: true,
              moduleSlug: slug,
              tags: JSON.stringify(agentDef.tags || []),
            },
          });
        }
      }
    }

    if (manifest.skills) {
      for (const skillDef of manifest.skills) {
        await prisma.skill.upsert({
          where: { name: skillDef.name },
          update: {},
          create: {
            name: skillDef.name,
            description: skillDef.description || "",
            inputSchema: JSON.stringify(skillDef.inputSchema || {}),
            outputSchema: JSON.stringify(skillDef.outputSchema || {}),
            implementationPath: `modules/${slug}/${skillDef.name}.ts`,
            enabled: true,
            version: mod.version,
          },
        });
      }
    }

    if (manifest.scheduledTasks) {
      for (const taskDef of manifest.scheduledTasks) {
        const existing = await prisma.scheduledTask.findFirst({ where: { name: taskDef.name } });
        if (!existing) {
          await prisma.scheduledTask.create({
            data: {
              name: taskDef.name,
              description: taskDef.description || "",
              intervalMin: taskDef.intervalMin || 60,
              taskType: "module",
              taskConfig: JSON.stringify({ moduleSlug: slug }),
              enabled: true,
            },
          });
        }
      }
    }

    // Initialize settings with defaults
    if (manifest.settings) {
      const config = JSON.parse(mod.config || "{}");
      for (const field of manifest.settings) {
        if (field.default && !config[field.key]) {
          config[field.key] = field.default;
          const settingKey = `module_${slug}_${field.key}`;
          await prisma.setting.upsert({
            where: { key: settingKey },
            update: {},
            create: { key: settingKey, value: String(field.default) },
          });
        }
      }
      await prisma.module.update({ where: { slug }, data: { config: JSON.stringify(config) } });
    }

    fs.writeFileSync(path.join(moduleDir, "manifest.json"), JSON.stringify(manifest, null, 2));

    // Status depends on whether required config is filled
    const hasRequiredConfig = !manifest.settings?.some((f: any) => f.required);
    const status = hasRequiredConfig ? "installed" : "needs_config";

    await prisma.module.update({
      where: { slug },
      data: { status, installedAt: new Date() },
    });

    await log("info", "modules", `Module "${mod.name}" installed`, { slug });
    return {
      success: true,
      message: `Module "${mod.name}" installed`,
      needsConfig: !hasRequiredConfig,
      configFields: manifest.settings || [],
    };
  });

  // Uninstall a module
  app.post("/api/modules/:slug/uninstall", async (req) => {
    const { slug } = req.params as { slug: string };
    const mod = await prisma.module.findUniqueOrThrow({ where: { slug } });

    if (mod.status === "available") {
      return { success: false, message: "Not installed" };
    }

    await prisma.agent.deleteMany({ where: { moduleSlug: slug } });

    const tasks = await prisma.scheduledTask.findMany({ where: { taskConfig: { contains: slug } } });
    for (const t of tasks) await prisma.scheduledTask.delete({ where: { id: t.id } });

    // Clean up module settings
    const settings = await prisma.setting.findMany({ where: { key: { startsWith: `module_${slug}_` } } });
    for (const s of settings) await prisma.setting.delete({ where: { key: s.key } });

    await prisma.module.update({
      where: { slug },
      data: { status: "available", installedAt: null, config: "{}" },
    });

    await log("info", "modules", `Module "${mod.name}" uninstalled`, { slug });
    return { success: true, message: `Module "${mod.name}" uninstalled` };
  });

  // Mark module as fully configured after settings are filled
  app.post("/api/modules/:slug/activate", async (req) => {
    const { slug } = req.params as { slug: string };
    const mod = await prisma.module.findUniqueOrThrow({ where: { slug } });
    const manifest = JSON.parse(mod.manifest || "{}");
    const config = JSON.parse(mod.config || "{}");

    const missing: string[] = [];
    if (manifest.settings) {
      for (const field of manifest.settings) {
        if (field.required && !config[field.key]) missing.push(field.label || field.key);
      }
    }

    if (missing.length > 0) {
      return { success: false, missing };
    }

    await prisma.module.update({ where: { slug }, data: { status: "installed" } });
    return { success: true };
  });
}
