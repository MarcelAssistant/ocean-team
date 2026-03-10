-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "project" TEXT NOT NULL DEFAULT 'General';
ALTER TABLE "Ticket" ADD COLUMN "parentTicketId" TEXT;
