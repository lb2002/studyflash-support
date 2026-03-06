-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED', 'AUTO_CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('SUBSCRIPTION_CANCELLATION', 'REFUND_REQUEST', 'FLASHCARD_ISSUES', 'ACCOUNT_ISSUES', 'BILLING_INVOICE', 'CONTENT_UPLOAD', 'TECHNICAL_ERRORS', 'LANGUAGE_ISSUES', 'DATA_LOSS', 'QUIZ_ISSUES', 'PODCAST_ISSUES', 'MINDMAP_ISSUES', 'MOCK_EXAM_ISSUES', 'SUMMARY_ISSUES', 'GENERAL_HOW_TO', 'MISUNDERSTANDING', 'GARBAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "MessageSource" AS ENUM ('INBOUND_EMAIL', 'OUTBOUND_EMAIL', 'OUTBOUND_OUTLOOK', 'INTERNAL_NOTE', 'AI_DRAFT');

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'support',
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "subject" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "category" "TicketCategory",
    "tags" TEXT[],
    "customerEmail" TEXT,
    "customerName" TEXT,
    "language" TEXT,
    "translatedSubject" TEXT,
    "aiSummary" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "aiSuggestedAssignee" TEXT,
    "outlookMessageId" TEXT,
    "outlookConversationId" TEXT,
    "source" TEXT,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bodyTranslated" TEXT,
    "source" "MessageSource" NOT NULL,
    "senderEmail" TEXT,
    "senderName" TEXT,
    "teamMemberId" TEXT,
    "outlookMessageId" TEXT,
    "ticketId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrichment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrichment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_email_key" ON "TeamMember"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_externalId_key" ON "Ticket"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_outlookMessageId_key" ON "Ticket"("outlookMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_outlookMessageId_key" ON "Message"("outlookMessageId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrichment" ADD CONSTRAINT "Enrichment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
