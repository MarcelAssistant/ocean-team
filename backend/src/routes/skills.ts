import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import fs from "fs";
import path from "path";

const SKILLS_DIR = path.resolve(import.meta.dirname, "../../../skills");

export async function skillRoutes(app: FastifyInstance) {
  app.get("/api/skills", async () => {
    return prisma.skill.findMany({
      include: { agentSkills: { include: { agent: true } } },
      orderBy: { name: "asc" },
    });
  });

  app.get("/api/skills/:id", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.skill.findUniqueOrThrow({
      where: { id },
      include: { agentSkills: { include: { agent: true } } },
    });
  });

  app.post("/api/skills", async (req) => {
    const body = req.body as any;
    return prisma.skill.create({
      data: {
        name: body.name,
        description: body.description || "",
        inputSchema: JSON.stringify(body.inputSchema || {}),
        outputSchema: JSON.stringify(body.outputSchema || {}),
        implementationPath: body.implementationPath || "",
        enabled: body.enabled ?? true,
        version: body.version || "1.0.0",
      },
    });
  });

  app.put("/api/skills/:id", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as any;
    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.inputSchema !== undefined) data.inputSchema = JSON.stringify(body.inputSchema);
    if (body.outputSchema !== undefined) data.outputSchema = JSON.stringify(body.outputSchema);
    if (body.implementationPath !== undefined) data.implementationPath = body.implementationPath;
    if (body.enabled !== undefined) data.enabled = body.enabled;
    if (body.version !== undefined) data.version = body.version;
    return prisma.skill.update({ where: { id }, data });
  });

  app.delete("/api/skills/:id", async (req) => {
    const { id } = req.params as { id: string };
    await prisma.skill.delete({ where: { id } });
    return { success: true };
  });

  // Skill gaps
  app.get("/api/skill-gaps", async () => {
    return prisma.skillGap.findMany({ orderBy: { createdAt: "desc" } });
  });

  app.post("/api/skill-gaps/:id/generate", async (req) => {
    const { id } = req.params as { id: string };
    const gap = await prisma.skillGap.findUniqueOrThrow({ where: { id } });

    const skillDir = path.join(SKILLS_DIR, gap.skillName);
    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }

    const implPath = path.join(skillDir, "index.ts");
    const testPath = path.join(skillDir, "index.test.ts");
    const metaPath = path.join(skillDir, "meta.json");

    const meta = {
      name: gap.skillName,
      description: `Auto-generated stub for: ${gap.skillName}`,
      version: "0.1.0",
      inputSchema: { type: "object", properties: { input: { type: "string" } } },
      outputSchema: { type: "object", properties: { result: { type: "string" } } },
    };

    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    fs.writeFileSync(
      implPath,
      `// Skill: ${gap.skillName}
// Auto-generated stub — implement your logic here

export interface ${toPascal(gap.skillName)}Input {
  input: string;
}

export interface ${toPascal(gap.skillName)}Output {
  result: string;
}

export async function execute(params: ${toPascal(gap.skillName)}Input): Promise<${toPascal(gap.skillName)}Output> {
  // TODO: Implement ${gap.skillName}
  throw new Error("Skill '${gap.skillName}' is not yet implemented");
}
`
    );

    fs.writeFileSync(
      testPath,
      `import { describe, it, expect } from "vitest";
import { execute } from "./index.js";

describe("${gap.skillName}", () => {
  it("should execute successfully", async () => {
    // TODO: implement test
    await expect(execute({ input: "test" })).rejects.toThrow("not yet implemented");
  });
});
`
    );

    const skill = await prisma.skill.create({
      data: {
        name: gap.skillName,
        description: meta.description,
        inputSchema: JSON.stringify(meta.inputSchema),
        outputSchema: JSON.stringify(meta.outputSchema),
        implementationPath: implPath,
        enabled: false,
        version: "0.1.0",
      },
    });

    await prisma.skillGap.update({
      where: { id },
      data: { resolved: true, generatedPath: implPath },
    });

    return { skill, generatedFiles: [implPath, testPath, metaPath] };
  });
}

function toPascal(s: string): string {
  return s
    .split(/[_\-\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}
