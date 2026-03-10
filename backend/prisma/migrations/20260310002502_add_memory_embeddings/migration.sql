-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Memory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'note',
    "content" TEXT NOT NULL,
    "ticketId" TEXT,
    "embedding" TEXT NOT NULL DEFAULT '',
    "chunkIndex" INTEGER NOT NULL DEFAULT 0,
    "sourceId" TEXT,
    "relevance" REAL NOT NULL DEFAULT 1.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Memory_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Memory" ("agentId", "content", "createdAt", "id", "ticketId", "type") SELECT "agentId", "content", "createdAt", "id", "ticketId", "type" FROM "Memory";
DROP TABLE "Memory";
ALTER TABLE "new_Memory" RENAME TO "Memory";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
