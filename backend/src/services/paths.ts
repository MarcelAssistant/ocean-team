import path from "path";

// Prisma resolves file: paths relative to prisma/schema.prisma
// So we do the same: backend/prisma/ + ../../data/zeus.db = zeus/data/zeus.db
const PRISMA_DIR = path.resolve(import.meta.dirname, "../../prisma");

export function getDbPath(): string {
  const dbUrl = process.env.DATABASE_URL || "file:../../data/zeus.db";
  const dbFile = dbUrl.replace(/^file:/, "");
  return path.resolve(PRISMA_DIR, dbFile);
}

export function getDataDir(): string {
  return path.dirname(getDbPath());
}
