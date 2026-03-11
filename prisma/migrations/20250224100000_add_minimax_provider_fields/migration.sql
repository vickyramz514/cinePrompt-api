-- AlterTable
ALTER TABLE "VideoJob" ALTER COLUMN "provider" SET DEFAULT 'MINIMAX';

-- AlterTable
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "externalJobId" TEXT;
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "providerStatus" TEXT;
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "providerPayload" JSONB;
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "providerResponse" JSONB;
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "videoDurationSec" INTEGER;
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "videoResolution" TEXT;
ALTER TABLE "VideoJob" ADD COLUMN IF NOT EXISTS "providerCost" DOUBLE PRECISION;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "VideoJob_externalJobId_key" ON "VideoJob"("externalJobId");
CREATE INDEX IF NOT EXISTS "VideoJob_externalJobId_idx" ON "VideoJob"("externalJobId");

-- AlterTable CreditLock
ALTER TABLE "CreditLock" ADD COLUMN IF NOT EXISTS "credits" INTEGER;
