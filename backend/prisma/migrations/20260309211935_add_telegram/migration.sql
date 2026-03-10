-- CreateTable
CREATE TABLE "TelegramPairing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramChatId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "conversationId" TEXT,
    "chatTitle" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramPairing_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TelegramPairingCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramPairing_telegramChatId_key" ON "TelegramPairing"("telegramChatId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramPairingCode_code_key" ON "TelegramPairingCode"("code");
