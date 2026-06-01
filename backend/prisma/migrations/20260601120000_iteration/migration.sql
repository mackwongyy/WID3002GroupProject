-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "ticket_interactions"
ADD COLUMN "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'SUCCESS',
ADD COLUMN "analysisError" TEXT;

-- CreateTable
CREATE TABLE "analysis_runs" (
    "id" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL,
    "modelName" TEXT,
    "modelVersion" TEXT,
    "promptVersion" TEXT,
    "rawOutput" JSONB,
    "category" TEXT,
    "urgency" "UrgencyLevel",
    "sentiment" "SentimentLabel",
    "department" TEXT,
    "keyPhrases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "analysis_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analysis_runs_interactionId_idx" ON "analysis_runs"("interactionId");

-- CreateIndex
CREATE INDEX "analysis_runs_status_idx" ON "analysis_runs"("status");

-- AddForeignKey
ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "ticket_interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
