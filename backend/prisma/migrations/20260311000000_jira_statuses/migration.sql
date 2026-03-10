-- Migrate existing ticket statuses to Jira-style workflow
-- created, ready, in_progress, blocked, finished, failed, cancel

UPDATE "Ticket" SET "status" = 'ready' WHERE "status" = 'queued' AND "agentId" IS NOT NULL;
UPDATE "Ticket" SET "status" = 'created' WHERE "status" = 'queued' AND "agentId" IS NULL;
UPDATE "Ticket" SET "status" = 'finished' WHERE "status" = 'done';
