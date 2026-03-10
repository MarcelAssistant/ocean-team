import crypto from "crypto";
import { prisma } from "../db.js";

const activeSessions = new Map<string, { createdAt: number }>();
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
}

export async function isOnboarded(): Promise<boolean> {
  const pw = await prisma.setting.findUnique({ where: { key: "access_password_hash" } });
  return !!(pw?.value);
}

export async function setupPassword(password: string): Promise<void> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(password, salt);
  await prisma.setting.upsert({
    where: { key: "access_password_hash" },
    update: { value: `${salt}:${hash}` },
    create: { key: "access_password_hash", value: `${salt}:${hash}` },
  });
}

export async function verifyPassword(password: string): Promise<boolean> {
  const pw = await prisma.setting.findUnique({ where: { key: "access_password_hash" } });
  if (!pw?.value) return false;

  const [salt, storedHash] = pw.value.split(":");
  const hash = hashPassword(password, salt);
  return hash === storedHash;
}

export function createSession(): string {
  const token = crypto.randomBytes(32).toString("hex");
  activeSessions.set(token, { createdAt: Date.now() });
  return token;
}

export function validateSession(token: string): boolean {
  const session = activeSessions.get(token);
  if (!session) return false;
  if (Date.now() - session.createdAt > SESSION_TTL) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

export function destroySession(token: string): void {
  activeSessions.delete(token);
}

export async function getVmAddress(): Promise<string> {
  const addr = await prisma.setting.findUnique({ where: { key: "vm_address" } });
  return addr?.value || "";
}

export async function setVmAddress(address: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key: "vm_address" },
    update: { value: address },
    create: { key: "vm_address", value: address },
  });
}
