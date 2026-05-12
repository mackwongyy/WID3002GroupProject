-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "UrgencyLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SentimentLabel" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticketName" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_interactions" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "userText" TEXT NOT NULL,
    "modelOutput" JSONB NOT NULL,
    "category" TEXT NOT NULL,
    "urgency" "UrgencyLevel" NOT NULL,
    "urgencyColour" TEXT NOT NULL,
    "sentiment" "SentimentLabel" NOT NULL,
    "department" TEXT NOT NULL,
    "keyPhrases" TEXT[],
    "modelName" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_validations" (
    "id" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "correctedCategory" TEXT,
    "correctedUrgency" "UrgencyLevel",
    "correctedSentiment" "SentimentLabel",
    "correctedDepartment" TEXT,
    "notes" TEXT,
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_validations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_vectors" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "clusterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_vectors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_displayId_key" ON "tickets"("displayId");

-- CreateIndex
CREATE INDEX "tickets_userId_status_idx" ON "tickets"("userId", "status");

-- CreateIndex
CREATE INDEX "tickets_displayId_idx" ON "tickets"("displayId");

-- CreateIndex
CREATE INDEX "ticket_interactions_category_idx" ON "ticket_interactions"("category");

-- CreateIndex
CREATE INDEX "ticket_interactions_urgency_idx" ON "ticket_interactions"("urgency");

-- CreateIndex
CREATE INDEX "ticket_interactions_sentiment_idx" ON "ticket_interactions"("sentiment");

-- CreateIndex
CREATE INDEX "ticket_interactions_department_idx" ON "ticket_interactions"("department");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_interactions_ticketId_stepNumber_key" ON "ticket_interactions"("ticketId", "stepNumber");

-- CreateIndex
CREATE INDEX "admin_validations_interactionId_idx" ON "admin_validations"("interactionId");

-- CreateIndex
CREATE INDEX "admin_validations_adminId_idx" ON "admin_validations"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_vectors_interactionId_key" ON "ticket_vectors"("interactionId");

-- CreateIndex
CREATE INDEX "ticket_vectors_ticketId_idx" ON "ticket_vectors"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_vectors_clusterId_idx" ON "ticket_vectors"("clusterId");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_interactions" ADD CONSTRAINT "ticket_interactions_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_validations" ADD CONSTRAINT "admin_validations_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "ticket_interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_validations" ADD CONSTRAINT "admin_validations_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_vectors" ADD CONSTRAINT "ticket_vectors_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_vectors" ADD CONSTRAINT "ticket_vectors_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "ticket_interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
